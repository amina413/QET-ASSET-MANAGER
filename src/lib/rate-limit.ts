import { logger } from '@/lib/logger';

type CounterEntry = { count: number; resetAt: number };

// WARNING: per-process only. Under multi-instance deployments (Vercel, PM2 cluster,
// Docker replicas) each worker has its own Map, making the effective limit
// `limit × number_of_workers`. Set REQUIRE_DISTRIBUTED_RATE_LIMITS=true in production
// and configure UPSTASH_REDIS_REST_URL/TOKEN to enforce a shared limit.
const memoryCounters = new Map<string, CounterEntry>();

function mustUseDistributedRateLimit(): boolean {
  return process.env.REQUIRE_DISTRIBUTED_RATE_LIMITS === 'true';
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function incrementWithRedis(key: string, windowMs: number): Promise<number> {
  const config = redisConfig();
  if (!config) throw new Error('Redis rate limit store is not configured');

  // Atomic Lua script: INCR and set TTL on first increment in a single round-trip.
  // Avoids the race where INCR succeeds but PEXPIRE never executes (e.g. process crash).
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['EVAL', "local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return c", 1, key, windowMs],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Redis rate limit request failed with status ${response.status}`);
  }

  const results = await response.json() as Array<{ result?: number }>;
  return Number(results[0]?.result ?? 0);
}

async function getCountWithRedis(key: string): Promise<number> {
  const config = redisConfig();
  if (!config) throw new Error('Redis rate limit store is not configured');

  const response = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });

  if (!response.ok) {
    throw new Error(`Redis rate limit get failed with status ${response.status}`);
  }

  const data = await response.json() as { result?: string | number | null };
  return Number(data.result ?? 0);
}

function incrementWithMemory(key: string, windowMs: number): number {
  const now = Date.now();
  const entry = memoryCounters.get(key);
  if (!entry || now > entry.resetAt) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count++;
  return entry.count;
}

function getCountWithMemory(key: string): number {
  const entry = memoryCounters.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    memoryCounters.delete(key);
    return 0;
  }
  return entry.count;
}

export async function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const namespacedKey = `qet:${input.key}`;
  let count: number;

  try {
    count = redisConfig()
      ? await incrementWithRedis(namespacedKey, input.windowMs)
      : incrementWithMemory(namespacedKey, input.windowMs);
  } catch (error) {
    logger.error('[rate-limit] store unavailable', { error });
    if (mustUseDistributedRateLimit()) return { allowed: false, remaining: 0 };
    count = incrementWithMemory(namespacedKey, input.windowMs);
  }

  return {
    allowed: count <= input.limit,
    remaining: Math.max(input.limit - count, 0),
  };
}

export async function isRateLimited(input: {
  key: string;
  limit: number;
}): Promise<boolean> {
  const namespacedKey = `qet:${input.key}`;
  let count: number;
  try {
    count = redisConfig()
      ? await getCountWithRedis(namespacedKey)
      : getCountWithMemory(namespacedKey);
  } catch (error) {
    logger.error('[rate-limit] store unavailable', { error });
    if (mustUseDistributedRateLimit()) return true;
    count = getCountWithMemory(namespacedKey);
  }

  return count >= input.limit;
}

export async function isDistributedRateLimitConfigured(): Promise<boolean> {
  return !!redisConfig();
}

export function resetRateLimitForTests(): void {
  if (process.env.NODE_ENV !== 'test') return;
  memoryCounters.clear();
}
