import { ThrottlerModuleOptions } from '@nestjs/throttler';

// ─────────────────────────────────────────────────────────────────
// One throttler, deliberately.
//
// Every throttler registered here is evaluated on EVERY route — a named
// throttler is not opt-in. Registering `auth` (10/min) and `upload` (20/hour)
// alongside `default` therefore capped the entire API at 10 requests per
// minute and 20 per hour per IP, which is what a plain GET returning
// `Retry-After-auth` was reporting.
//
// Stricter endpoints now override this same throttler instead of adding a
// second one — see AUTH_THROTTLE / UPLOAD_THROTTLE below.
// ─────────────────────────────────────────────────────────────────
export const throttlerConfig: ThrottlerModuleOptions = [
  {
    name: 'default',
    ttl: 60_000, // 60 seconds
    limit: 300, // 300 requests per IP per minute — generous default
  },
];

// Credential endpoints — brute-force protection.
// Usage: @Throttle(AUTH_THROTTLE)
export const AUTH_THROTTLE = {
  default: { ttl: 60_000, limit: 10 },
};

// File-write endpoints — MinIO writes are expensive.
// Usage: @Throttle(UPLOAD_THROTTLE)
export const UPLOAD_THROTTLE = {
  default: { ttl: 3_600_000, limit: 20 },
};
