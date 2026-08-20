import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),

  // Database
  DATABASE_URI: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // MinIO
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().default('taskflow'),
  MINIO_USE_SSL: Joi.string().valid('true', 'false').default('false'),
  // 5 MB is the S3 minimum part size and the MinIO SDK's hard floor
  MINIO_PART_SIZE_MB: Joi.number().min(5).max(5120).default(5),
  MINIO_REGION: Joi.string().default('us-east-1'),
  MINIO_PUBLIC_URL: Joi.string().uri().allow('').default(''),

  // Email
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  SMTP_FROM: Joi.string().required(),

  // Upload
  MAX_UPLOAD_MB: Joi.number().min(1).default(100),
  MAX_IMAGE_UPLOAD_MB: Joi.number().min(1).default(5),
  PRESIGNED_URL_EXPIRY: Joi.number().min(1).max(604800).default(3600),
});
