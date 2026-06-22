import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, isRateLimited, resetRateLimitForTests } from './rate-limit';

describe('rate limit helper', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    resetRateLimitForTests();
  });

  it('checks lockout state without incrementing the counter', async () => {
    const key = 'login:user@example.com:127.0.0.1';

    await expect(isRateLimited({ key, limit: 2 })).resolves.toBe(false);
    await expect(isRateLimited({ key, limit: 2 })).resolves.toBe(false);

    await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    await expect(isRateLimited({ key, limit: 2 })).resolves.toBe(false);

    await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    await expect(isRateLimited({ key, limit: 2 })).resolves.toBe(true);
  });

  it('fails closed when the required distributed store is unavailable', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubEnv('REQUIRE_DISTRIBUTED_RATE_LIMITS', 'true');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('redis unavailable')));

    await expect(checkRateLimit({ key: 'api:127.0.0.1', limit: 1, windowMs: 60_000 }))
      .resolves.toEqual({ allowed: false, remaining: 0 });
    await expect(isRateLimited({ key: 'login:user@example.com:127.0.0.1', limit: 1 }))
      .resolves.toBe(true);
  });
});
