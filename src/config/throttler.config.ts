import { ThrottlerModuleOptions } from '@nestjs/throttler';

// ─────────────────────────────────────────────────────────────────
// Rate limit tiers used throughout the app via @Throttle({ <name>: {...} })
// Named throttlers so different endpoints can opt into stricter
// or looser limits without redefining numbers everywhere.
// ─────────────────────────────────────────────────────────────────
export const throttlerConfig: ThrottlerModuleOptions = [
  {
    name: 'default',
    ttl: 60_000, // 60 seconds
    limit: 300, // 300 requests per IP per minute — generous default
  },
  {
    name: 'auth',
    ttl: 60_000, // 60 seconds
    limit: 10, // 10 requests per IP per minute — brute-force protection
  },
  {
    name: 'upload',
    ttl: 3_600_000, // 1 hour
    limit: 20, // 20 uploads per IP per hour
  },
];
