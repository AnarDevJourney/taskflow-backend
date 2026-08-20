import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { AppConfigModule } from '@config/config.module';
import { AppConfigService } from '@config/config.service';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';
import { MinioService } from './minio.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new Minio.Client({
          endPoint: config.minioEndpoint,
          port: config.minioPort,
          useSSL: config.minioUseSSL,
          accessKey: config.minioAccessKey,
          secretKey: config.minioSecretKey,
          // Pinning partSize sets the SDK's overRidePartSize flag, so every
          // upload goes through BlockStream at exactly this chunk size. Without
          // it the SDK picks 64 MB and buffers anything smaller entirely in RAM.
          partSize: config.minioPartSizeBytes,
        }),
    },
    {
      provide: MINIO_PRESIGN_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const publicUrl = new URL(config.minioPublicUrl);
        const useSSL = publicUrl.protocol === 'https:';

        return new Minio.Client({
          endPoint: publicUrl.hostname,
          port: publicUrl.port ? Number(publicUrl.port) : useSSL ? 443 : 80,
          useSSL,
          accessKey: config.minioAccessKey,
          secretKey: config.minioSecretKey,
          // Pinned so signing never needs a GetBucketLocation round trip —
          // the public address is usually not reachable from inside the API
          // container, and signing must not depend on it being so.
          region: config.minioRegion,
        });
      },
    },
    MinioService,
  ],
  exports: [MinioService, MINIO_CLIENT],
})
export class StorageModule implements OnModuleInit {
  private readonly logger = new Logger(StorageModule.name);

  constructor(private readonly minio: MinioService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.minio.ensureBucket();
      this.logger.log(`MinIO bucket ready: ${this.minio.bucket}`);
    } catch (err) {
      // A dead object store must not stop the API from booting — every
      // upload endpoint surfaces the failure as a 500 on its own.
      this.logger.error('MinIO bucket bootstrap failed', err as Error);
    }
  }
}
