import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const globalForRedis = global as unknown as { redis: Redis | null };

export const redis =
  globalForRedis.redis ||
  (redisUrl
    ? new Redis(redisUrl, {
        family: 4,
        maxRetriesPerRequest: null,
        connectTimeout: 20000,
        retryStrategy(times) {
          const delay = Math.min(times * 200, 2000);
          return delay;
        },
      })
    : null);

if (redis) {
  redis.on('error', (err) => {
    // Evitar que errores transitorios de socket rompan el proceso de Node
    console.warn('⚠️ [Redis Warning]:', err.message);
  });
}

if (process.env.NODE_ENV !== 'production' && redis) {
  globalForRedis.redis = redis;
}
