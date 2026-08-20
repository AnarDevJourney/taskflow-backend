export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
    url: process.env.APP_URL || 'http://localhost:3000',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(
      ',',
    ),
  },
  database: {
    uri: process.env.DATABASE_URI,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET || 'taskflow',
    // Fixed multipart part size. Pinning it is what keeps uploads streaming:
    // the MinIO SDK buffers the WHOLE object in RAM when its computed part
    // size is >= the object size, and its default part size is 64 MB.
    partSizeMb: parseInt(process.env.MINIO_PART_SIZE_MB ?? '5', 10) || 5,
    region: process.env.MINIO_REGION || 'us-east-1',
    // Public base URL used to build direct links for objects under the
    // public/ prefix (avatars, workspace logos). Falls back to the
    // endpoint/port pair when not set — override it when MinIO sits behind
    // a reverse proxy or CDN.
    publicUrl: process.env.MINIO_PUBLIC_URL || '',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  upload: {
    maxMb: parseInt(process.env.MAX_UPLOAD_MB ?? '100', 10) || 100,
    maxImageMb: parseInt(process.env.MAX_IMAGE_UPLOAD_MB ?? '5', 10) || 5,
    presignedUrlExpiry:
      parseInt(process.env.PRESIGNED_URL_EXPIRY ?? '3600', 10) || 3600,
  },
});
