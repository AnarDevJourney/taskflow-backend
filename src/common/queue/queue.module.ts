import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigModule } from '@config/config.module';
import { AppConfigService } from '@config/config.service';

// Root BullMQ configuration — shared by every queue in the app.
// Queues themselves are registered per-feature with BullModule.registerQueue()
// (see NotificationsModule), this only supplies the Redis connection and the
// default retry/retention policy every job inherits.
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        // bullmq accepts a redis:// URL directly and hands it to ioredis
        connection: { url: config.redisUrl },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          // keep a short history so failures stay debuggable without
          // letting Redis grow unbounded
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600, count: 5000 },
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
