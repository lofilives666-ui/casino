type Bucket = {
  hits: number[];
};

declare global {
  var __rateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets = global.__rateLimitBuckets ?? new Map<string, Bucket>();
if (!global.__rateLimitBuckets) {
  global.__rateLimitBuckets = buckets;
}

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const { key, limit, windowMs } = input;
  const now = Date.now();
  const windowStart = now - windowMs;

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((ts) => ts > windowStart);

  if (bucket.hits.length >= limit) {
    const retryAt = bucket.hits[0] + windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((retryAt - now) / 1000));
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSec,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    retryAfterSec: 0,
  };
}
