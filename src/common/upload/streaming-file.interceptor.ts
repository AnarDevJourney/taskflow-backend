import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Request, Response } from 'express';
import * as multer from 'multer';
import { MinioService } from '@common/storage/minio.service';
import { MinioStreamingStorage } from './minio-streaming.storage';
import {
  FileTooLargeException,
  MissingFileException,
  UnsupportedFileTypeException,
} from './upload.errors';
import type { UploadTargetResolver } from './upload.types';

// Envelope overhead of the multipart body (boundaries + text fields) that the
// Content-Length pre-flight has to tolerate before it can call an upload
// oversized. Generous on purpose: the real ceiling is enforced per byte below.
const MULTIPART_OVERHEAD_ALLOWANCE = 16 * 1024;

/**
 * Replacement for `FileInterceptor` that never buffers.
 *
 * Unlike the stock interceptor it takes a resolver: a provider that decides,
 * per endpoint, which MIME types are allowed, how large the file may be, and
 * which object key it lands on — including any database lookups needed to
 * authorise the upload. All of that runs before the body is streamed.
 *
 * NOTE ON FIELD ORDER: a streaming parser sees multipart parts in wire order,
 * so the text fields a resolver reads off `req.body` must be appended to the
 * FormData *before* the file field. Resolvers report a clear 400 when they
 * are not.
 */
export function StreamingFileInterceptor(
  fieldName: string,
  resolverType: Type<UploadTargetResolver>,
): Type<NestInterceptor> {
  @Injectable()
  class StreamingFileMixinInterceptor implements NestInterceptor {
    private handler: ReturnType<multer.Multer['single']> | null = null;

    constructor(
      private readonly minio: MinioService,
      private readonly moduleRef: ModuleRef,
    ) {}

    async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<ReturnType<CallHandler['handle']>> {
      const http = context.switchToHttp();
      const req = http.getRequest<Request>();
      const res = http.getResponse<Response>();

      const resolver = this.moduleRef.get(resolverType, { strict: false });

      this.assertDeclaredSizeWithinLimit(req, resolver.maxBytes);

      await this.runMulter(req, res, resolver);

      if (!req.file) throw new MissingFileException(fieldName);

      return next.handle();
    }

    // Cheap rejection before the body is read at all: a request that cannot
    // possibly fit is refused without writing a partial object to MinIO first.
    private assertDeclaredSizeWithinLimit(req: Request, maxBytes: number) {
      const declared = Number(req.headers['content-length']);
      if (
        Number.isFinite(declared) &&
        declared > maxBytes + MULTIPART_OVERHEAD_ALLOWANCE
      ) {
        throw new FileTooLargeException(maxBytes);
      }
    }

    private runMulter(
      req: Request,
      res: Response,
      resolver: UploadTargetResolver,
    ): Promise<void> {
      this.handler ??= multer({
        storage: new MinioStreamingStorage(this.minio, resolver),
        limits: {
          fileSize: resolver.maxBytes, // hard backstop; truncates and rolls back
          files: 1,
          fields: 20,
        },
        fileFilter: (_req, file, cb) => {
          if (!resolver.allowedMimeTypes.includes(file.mimetype)) {
            return cb(
              new UnsupportedFileTypeException(
                file.mimetype,
                resolver.allowedMimeTypes,
              ),
            );
          }
          cb(null, true);
        },
      }).single(fieldName);

      return new Promise<void>((resolve, reject) => {
        this.handler!(req, res, (err: unknown) =>
          err ? reject(toHttpError(err, resolver.maxBytes)) : resolve(),
        );
      });
    }
  }

  return mixin(StreamingFileMixinInterceptor);
}

// Multer reports its own limits as MulterError instances. Map them onto the
// API's error contract; anything a resolver or the storage engine threw is
// already an HttpException and passes straight through.
function toHttpError(err: unknown, maxBytes: number): Error {
  if (!(err instanceof multer.MulterError)) {
    return err instanceof Error ? err : new BadRequestException(String(err));
  }

  if (err.code === 'LIMIT_FILE_SIZE')
    return new FileTooLargeException(maxBytes);

  // Every other multer limit is a malformed request, not a server fault.
  return new BadRequestException(
    err.field ? `${err.message} - ${err.field}` : err.message,
  );
}
