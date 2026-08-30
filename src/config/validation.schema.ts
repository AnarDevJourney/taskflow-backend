import * as Joi from 'joi';

// Placeholder secrets checked into .env / .env.docker as templates — must
// never make it into a real deployment. Keep this list in sync with
// scripts/prod.sh's own placeholder check.
const PLACEHOLDER_JWT_SECRETS = [
  'your-super-secret-key-min-32-chars-here',
  'your-refresh-secret-key-min-32-chars',
  'replace-this-with-a-real-32-char-minimum-secret',
  'replace-this-with-a-different-32-char-secret',
];

// MinIO's own default credentials — shipped as the default in .env / .env.docker
// so local Docker Compose works out of the box. Fine for local dev; anyone
// reaching the MinIO console/API with these gets full read/write on every bucket.
const DEFAULT_MINIO_CREDENTIAL = 'minioadmin';

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
})
  // Cross-field / production-only checks a per-key schema can't express.
  // Runs after every individual key already passed its own rule above.
  .custom((env, helpers) => {
    if (env.NODE_ENV !== 'production') return env;

    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      if (PLACEHOLDER_JWT_SECRETS.includes(env[key])) {
        return helpers.message({
          custom:
            `${key} is still the checked-in placeholder value — refusing to start in ` +
            'production. Generate a real secret (e.g. `openssl rand -hex 32`) and set ' +
            'it in .env.docker.',
        });
      }
    }

    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      return helpers.message({
        custom:
          'JWT_SECRET and JWT_REFRESH_SECRET must be different values — refusing to ' +
          'start in production.',
      });
    }

    for (const key of ['MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY']) {
      if (env[key] === DEFAULT_MINIO_CREDENTIAL) {
        return helpers.message({
          custom:
            `${key} is still the default MinIO credential ("minioadmin") — refusing ` +
            'to start in production. Set a real access key / secret key on the MinIO ' +
            'server and in .env.docker.',
        });
      }
    }

    return env;
  }, 'production secrets check');
