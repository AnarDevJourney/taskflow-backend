import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigModule } from '@config/config.module';
import { AppConfigService } from '@config/config.service';
import { REDIS_CLIENT } from './redis.constants';

const logger = new Logger('RedisModule');

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const client = new Redis(config.redisUrl);
        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err) => logger.error('Redis connection error', err));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
