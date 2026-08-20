import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Readable } from 'stream';
import * as Minio from 'minio';
import { AppConfigService } from '@config/config.service';
import {
  MINIO_CLIENT,
  MINIO_PRESIGN_CLIENT,
  PUBLIC_PREFIX,
} from './storage.constants';

export interface PutStreamOptions {
  /** Value for the object's Content-Type header. */
  mimeType: string;
  /** Original client-side filename, echoed back by Content-Disposition. */
  originalName?: string;
  /** Extra x-amz-meta-* entries. */
  metadata?: Record<string, string>;
}

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);

  constructor(
    @Inject(MINIO_CLIENT) private readonly client: Minio.Client,
    @Inject(MINIO_PRESIGN_CLIENT)
    private readonly presignClient: Minio.Client,
    private readonly config: AppConfigService,
  ) {}

  get bucket(): string {
    return this.config.minioBucket;
  }

  // ─── Bucket bootstrap ───────────────────────────────────────────
  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`MinIO bucket created: ${this.bucket}`);
    }
    await this.applyPublicPolicy();
  }

  // Anonymous read on the public/ prefix only. Avatars and workspace logos
  // are rendered by <img> tags all over the UI — handing out a presigned URL
  // for every one of them would mean an extra round trip per avatar and a
  // link that dies after an hour.
  private async applyPublicPolicy(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/${PUBLIC_PREFIX}/*`],
        },
      ],
    };

    await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
  }

  // ─── Upload ─────────────────────────────────────────────────────
  // `size` is intentionally optional. For a multipart request the length of
  // the file part is unknown up front, and passing `undefined` is what makes
  // the SDK take its chunked multipart path (constant RAM) instead of
  // buffering the whole object — see MINIO_PART_SIZE_MB in configuration.ts.
  async putStream(
    key: string,
    stream: Readable,
    size: number | undefined,
    options: PutStreamOptions,
  ): Promise<{ etag: string }> {
    const metadata: Record<string, string> = {
      'Content-Type': options.mimeType,
      ...(options.originalName
        ? {
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(
              options.originalName,
            )}`,
          }
        : {}),
      ...(options.metadata ?? {}),
    };

    const result = await this.client.putObject(
      this.bucket,
      key,
      stream,
      size,
      metadata,
    );

    return { etag: result.etag };
  }

  // ─── Download ───────────────────────────────────────────────────
  async presignedGetUrl(
    key: string,
    expirySeconds = this.config.presignedUrlExpiry,
    downloadName?: string,
  ): Promise<string> {
    const reqParams = downloadName
      ? {
          'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
            downloadName,
          )}`,
        }
      : undefined;

    // Signed by the public-facing client so the URL is valid from a browser.
    return this.presignClient.presignedGetObject(
      this.bucket,
      key,
      expirySeconds,
      reqParams,
    );
  }

  /** Direct, non-expiring URL. Only valid for keys under the public/ prefix. */
  publicUrl(key: string): string {
    return `${this.config.minioPublicUrl}/${this.bucket}/${key}`;
  }

  // ─── Delete ─────────────────────────────────────────────────────
  async removeObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  /**
   * Delete that never throws — used on rollback paths, where the error that
   * triggered the rollback is the one the caller must actually see. A failure
   * here leaves an orphaned object, which is logged and nothing more.
   */
  async removeQuietly(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (err) {
      this.logger.error(`Failed to roll back object ${key}`, err as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}
