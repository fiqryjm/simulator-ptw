import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkLoginRateLimit,
  clearAllRateLimits,
  recordFailedLogin,
  resetLoginRateLimit,
} from '@/lib/rate-limit';

describe('Login Rate Limiter', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  it('blocks after maxAttempts within window and resets on success', () => {
    const key = '127.0.0.1:user@demo.ptw.local';
    const config = { windowMs: 60_000, maxAttempts: 3 };
    const t0 = 1_000_000;

    expect(checkLoginRateLimit(key, t0, config).allowed).toBe(true);
    recordFailedLogin(key, t0 + 100, config);
    recordFailedLogin(key, t0 + 200, config);
    const third = recordFailedLogin(key, t0 + 300, config);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);

    // After window expires, attempts are allowed again
    expect(checkLoginRateLimit(key, t0 + 61_000, config).allowed).toBe(true);

    // Reset clears existing lock
    recordFailedLogin(key, t0 + 62_000, config);
    resetLoginRateLimit(key);
    expect(checkLoginRateLimit(key, t0 + 62_100, config).remaining).toBe(3);
  });
});
