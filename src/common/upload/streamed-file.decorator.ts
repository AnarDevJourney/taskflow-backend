import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { MissingFileException } from './upload.errors';
import type { StreamedFile } from './upload.types';

/**
 * Typed accessor for the file that StreamingFileInterceptor already streamed
 * into MinIO. Mirrors `@UploadedFile()`, but the object it yields carries the
 * object key rather than a buffer.
 */
export const StreamedFileMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StreamedFile => {
    const file = ctx.switchToHttp().getRequest<Request>().file;
    if (!file) throw new MissingFileException();
    return file as unknown as StreamedFile;
  },
);
