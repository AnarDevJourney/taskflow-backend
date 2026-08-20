import type { Request } from 'express';

/** The subset of the multer file object available *before* any byte is read. */
export interface IncomingFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
}

/** What a resolver decides once it has approved an upload. */
export interface UploadTarget {
  /** Full MinIO object key the stream will be written to. */
  key: string;
  /** Optional x-amz-meta-* entries stored alongside the object. */
  metadata?: Record<string, string>;
}

/**
 * Per-endpoint upload policy. Implementations are ordinary Nest providers, so
 * they can inject services and hit the database.
 *
 * `resolve()` runs *before* the file body is streamed anywhere — it is the
 * hook where ownership, existence and permission checks belong. Throwing any
 * HttpException from it aborts the request without touching object storage.
 */
export interface UploadTargetResolver {
  readonly allowedMimeTypes: readonly string[];
  readonly maxBytes: number;
  resolve(req: Request, file: IncomingFile): Promise<UploadTarget>;
}

/** What the storage engine hands back — merged onto `req.file` by multer. */
export interface StoredFileInfo {
  key: string;
  bucket: string;
  size: number;
  etag: string;
}

/** `req.file` as seen by a controller behind StreamingFileInterceptor. */
export type StreamedFile = IncomingFile & StoredFileInfo;
