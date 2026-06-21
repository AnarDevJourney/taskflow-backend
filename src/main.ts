import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import * as cookieParser from 'cookie-parser';
import { AppConfigService } from '@config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const appConfig = app.get(AppConfigService);

  app.use(cookieParser());

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
  });

  const reflector = app.get(Reflector);

  // global prefix
  app.setGlobalPrefix('api/v1');

  // global guard — all routes protected by default
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // global pipes — auto-validate all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true,
      transform: true, // auto-convert types (string '1' → number 1)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}/api/v1`);
}

bootstrap();
