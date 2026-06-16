import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, isRateLimited, resetRateLimitForTests } from './rate-limit';

describe('rate limit helper', () => {
  beforeEach(() => {
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
});
