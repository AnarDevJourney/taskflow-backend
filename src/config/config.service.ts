import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private config: ConfigService) {}

  // ─── App ────────────────────────────────────────────────────────
  get nodeEnv(): string {
    return this.config.get<string>('app.nodeEnv', 'development');
  }

  get port(): number {
    return this.config.get<number>('app.port', 3000);
  }

  get appUrl(): string {
    return this.config.get<string>('app.url', 'http://localhost:3000');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get corsOrigins(): string[] {
    return this.config.get<string[]>('app.corsOrigins', [
      'http://localhost:5173',
    ]);
  }

  // ─── Database ───────────────────────────────────────────────────
  get databaseUri(): string {
    return this.config.get<string>('database.uri', '');
  }

  // ─── Redis ──────────────────────────────────────────────────────
  get redisUrl(): string {
    return this.config.get<string>('redis.url', '');
  }

  // ─── JWT ────────────────────────────────────────────────────────
  get jwtSecret(): string {
    return this.config.get<string>('jwt.secret', '');
  }

  get jwtExpiresIn(): string {
    return this.config.get<string>('jwt.expiresIn', '15m');
  }

  get jwtRefreshSecret(): string {
    return this.config.get<string>('jwt.refreshSecret', '');
  }

  get jwtRefreshExpiresIn(): string {
    return this.config.get<string>('jwt.refreshExpiresIn', '7d');
  }

  // ─── MinIO ──────────────────────────────────────────────────────
  get minioEndpoint(): string {
    return this.config.get<string>('minio.endpoint', '');
  }

  get minioPort(): number {
    return this.config.get<number>('minio.port', 9000);
  }

  get minioAccessKey(): string {
    return this.config.get<string>('minio.accessKey', '');
  }

  get minioSecretKey(): string {
    return this.config.get<string>('minio.secretKey', '');
  }

  get minioBucket(): string {
    return this.config.get<string>('minio.bucket', 'taskflow');
  }

  get minioUseSSL(): boolean {
    return this.config.get<boolean>('minio.useSSL', false);
  }

  get minioRegion(): string {
    return this.config.get<string>('minio.region', 'us-east-1');
  }

  get minioPartSizeBytes(): number {
    return this.config.get<number>('minio.partSizeMb', 5) * 1024 * 1024;
  }

  // Base URL for objects served straight from MinIO (public/ prefix only).
  get minioPublicUrl(): string {
    const configured = this.config.get<string>('minio.publicUrl', '');
    if (configured) return configured.replace(/\/+$/, '');

    const scheme = this.minioUseSSL ? 'https' : 'http';
    const port = this.minioPort;
    const isDefaultPort =
      (this.minioUseSSL && port === 443) || (!this.minioUseSSL && port === 80);

    return isDefaultPort
      ? `${scheme}://${this.minioEndpoint}`
      : `${scheme}://${this.minioEndpoint}:${port}`;
  }

  // ─── Email ──────────────────────────────────────────────────────
  get smtpHost(): string {
    return this.config.get<string>('email.host', '');
  }

  get smtpPort(): number {
    return this.config.get<number>('email.port', 587);
  }

  get smtpUser(): string {
    return this.config.get<string>('email.user', '');
  }

  get smtpPass(): string {
    return this.config.get<string>('email.pass', '');
  }

  get smtpFrom(): string {
    return this.config.get<string>('email.from', '');
  }

  // ─── Upload ─────────────────────────────────────────────────────
  get maxUploadBytes(): number {
    return this.config.get<number>('upload.maxMb', 100) * 1024 * 1024;
  }

  // Separate, much smaller ceiling for avatars / workspace logos
  get maxImageUploadBytes(): number {
    return this.config.get<number>('upload.maxImageMb', 5) * 1024 * 1024;
  }

  get presignedUrlExpiry(): number {
    return this.config.get<number>('upload.presignedUrlExpiry', 3600);
  }
}
