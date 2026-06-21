import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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

  if (!appConfig.isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TaskFlow API')
      .setDescription(
        'Internal task management system API.\n\n' +
          '**Authentication**: All protected routes require an `access_token` HttpOnly cookie ' +
          'set by `POST /api/v1/auth/login` or `POST /api/v1/auth/register`. ' +
          'The token expires in 15 minutes.\n\n' +
          '**Token refresh**: `POST /api/v1/auth/refresh` reads the `refresh_token` HttpOnly cookie ' +
          '(valid 7 days, scoped to that path only) and issues new tokens.',
      )
      .setVersion('1.0')
      .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie', name: 'access_token', description: 'JWT access token — set automatically by login/register' }, 'cookie-access-token')
      .addCookieAuth('refresh_token', { type: 'apiKey', in: 'cookie', name: 'refresh_token', description: 'JWT refresh token — used only by POST /auth/refresh' }, 'cookie-refresh-token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { withCredentials: true },
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}/api/v1`);
}

bootstrap();
