import { Transform, TransformCallback } from 'stream';

/**
 * Pass-through that only counts. A streaming multipart upload has no
 * Content-Length for the file part, so the byte total that ends up in the
 * attachment metadata has to be measured as the data flows past.
 *
 * It deliberately does not enforce the size limit: multer's own
 * `limits.fileSize` truncates and aborts the request, and rolls the partial
 * object back through the storage engine's `_removeFile`. Erroring here
 * instead would leave MinIO's internal BlockStream waiting on a source that
 * never ends.
 */
export class ByteCounterStream extends Transform {
  private bytes = 0;

  get byteCount(): number {
    return this.bytes;
  }

  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.bytes += chunk.length;
    callback(null, chunk);
  }
}
