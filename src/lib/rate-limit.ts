export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface AttemptEntry {
  timestamps: number[];
}

const DEFAULT_LOGIN_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
};

const loginAttempts = new Map<string, AttemptEntry>();

function pruneExpired(timestamps: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((ts) => ts > cutoff);
}

/**
 * Checks whether a login attempt is allowed under the sliding-window rate limit.
 */
export function checkLoginRateLimit(
  key: string,
  now: number = Date.now(),
  config: RateLimitConfig = DEFAULT_LOGIN_CONFIG,
): RateLimitResult {
  const entry = loginAttempts.get(key);
  if (!entry) {
    return {
      allowed: true,
      remaining: config.maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  const active = pruneExpired(entry.timestamps, now, config.windowMs);
  if (active.length === 0) {
    loginAttempts.delete(key);
    return {
      allowed: true,
      remaining: config.maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  entry.timestamps = active;
  const remaining = Math.max(0, config.maxAttempts - active.length);
  if (active.length < config.maxAttempts) {
    return {
      allowed: true,
      remaining,
      retryAfterSeconds: 0,
    };
  }

  const oldest = active[0] ?? now;
  const retryAfterMs = Math.max(0, oldest + config.windowMs - now);
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  };
}

/**
 * Records a failed login attempt for the given key.
 */
export function recordFailedLogin(
  key: string,
  now: number = Date.now(),
  config: RateLimitConfig = DEFAULT_LOGIN_CONFIG,
): RateLimitResult {
  const entry = loginAttempts.get(key) ?? { timestamps: [] };
  const active = pruneExpired(entry.timestamps, now, config.windowMs);
  active.push(now);
  loginAttempts.set(key, { timestamps: active });
  return checkLoginRateLimit(key, now, config);
}

/**
 * Clears recorded failed attempts after a successful login.
 */
export function resetLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}

/**
 * Clears all in-memory rate limit entries (for testing).
 */
export function clearAllRateLimits(): void {
  loginAttempts.clear();
}
