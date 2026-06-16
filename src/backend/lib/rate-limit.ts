type CounterEntry = { count: number; resetAt: number };

const memoryCounters = new Map<string, CounterEntry>();

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function incrementWithRedis(key: string, windowMs: number): Promise<number> {
  const config = redisConfig();
  if (!config) throw new Error('Redis rate limit store is not configured');

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['PEXPIRE', key, windowMs],
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
  const count = redisConfig()
    ? await incrementWithRedis(namespacedKey, input.windowMs)
    : incrementWithMemory(namespacedKey, input.windowMs);

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
  const count = redisConfig()
    ? await getCountWithRedis(namespacedKey)
    : getCountWithMemory(namespacedKey);

  return count >= input.limit;
}

export async function isDistributedRateLimitConfigured(): Promise<boolean> {
  return !!redisConfig();
}

export function resetRateLimitForTests(): void {
  if (process.env.NODE_ENV !== 'test') return;
  memoryCounters.clear();
}
