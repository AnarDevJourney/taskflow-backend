import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import { HttpException, Logger } from '@nestjs/common';
import { MinioService } from '@common/storage/minio.service';
import { ByteCounterStream } from './byte-counter.stream';
import { StorageUploadFailedException } from './upload.errors';
import type {
  StoredFileInfo,
  UploadTarget,
  UploadTargetResolver,
} from './upload.types';

/**
 * Multer storage engine that pipes the incoming file part straight into
 * MinIO. There is no memoryStorage, no `file.buffer`, no temp file — the only
 * bytes held at any moment are the SDK's current 5 MB multipart chunk, so RAM
 * is flat regardless of whether the upload is 1 MB or 1 GB.
 */
export class MinioStreamingStorage implements StorageEngine {
  private readonly logger = new Logger(MinioStreamingStorage.name);

  constructor(
    private readonly minio: MinioService,
    private readonly resolver: UploadTargetResolver,
  ) {}

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    void this.handle(req, file).then(
      (info) => callback(null, info as Partial<Express.Multer.File>),
      (err: unknown) => callback(err),
    );
  }

  /** Called by multer when the request aborts after the object was written. */
  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    const { key } = file as unknown as Partial<StoredFileInfo>;
    if (!key) return callback(null);
    void this.minio.removeQuietly(key).then(() => callback(null));
  }

  private async handle(
    req: Request,
    file: Express.Multer.File,
  ): Promise<StoredFileInfo> {
    // ── Validation first: nothing is written until this resolves ──
    let target: UploadTarget;
    try {
      target = await this.resolver.resolve(req, file);
    } catch (err) {
      file.stream.resume(); // let busboy drain instead of stalling
      throw err;
    }

    // ── Then stream: source → byte counter → MinIO ──
    const counter = new ByteCounterStream();

    // A client that disconnects mid-upload errors the source stream. Ending
    // the counter gracefully (rather than destroying it) lets the SDK's
    // internal block stream finish instead of hanging on a dead source; the
    // recorded error is re-thrown below, after the partial object is removed.
    const source: { error: Error | null } = { error: null };
    file.stream.on('error', (err: Error) => {
      source.error = err;
      file.stream.unpipe(counter);
      counter.end();
    });
    file.stream.pipe(counter);

    try {
      const { etag } = await this.minio.putStream(
        target.key,
        counter,
        undefined,
        {
          mimeType: file.mimetype,
          originalName: file.originalname,
          metadata: target.metadata,
        },
      );

      if (source.error) throw source.error;

      return {
        key: target.key,
        bucket: this.minio.bucket,
        size: counter.byteCount,
        etag,
      };
    } catch (err) {
      await this.minio.removeQuietly(target.key);

      if (err instanceof HttpException) throw err;

      this.logger.error(`MinIO upload failed for ${target.key}`, err as Error);
      throw new StorageUploadFailedException();
    }
  }
}
