import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRedisClient() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redisClient) {
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
    });
  }
  return redisClient;
}

