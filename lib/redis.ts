import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const globalForRedis = global as unknown as { redis: Redis | null };

function createRedisInstance(): Redis | null {
  if (!redisUrl) return null;
  try {
    const parsed = new URL(redisUrl);
    const client = new Redis({
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      family: 4,
      connectTimeout: 8000,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      },
    });

    client.on('error', (err) => {
      console.warn('⚠️ [Redis Warning]:', err.message);
    });

    return client;
  } catch (err) {
    console.warn('⚠️ [Redis Init Error]:', err);
    return null;
  }
}

export const redis =
  globalForRedis.redis || createRedisInstance();

if (process.env.NODE_ENV !== 'production' && redis) {
  globalForRedis.redis = redis;
}
