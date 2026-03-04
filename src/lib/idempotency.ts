import { getRedisClient } from "@/lib/redis";

type CacheEntry = {
  status: number;
  body: unknown;
  expiresAt: number;
};

type BeginNewResult = {
  ok: true;
  reason: "NEW";
  response: null;
  cacheKey: string;
  lockKey: string;
  responseKey: string;
  backend: "redis" | "memory";
};

type BeginReplayResult = {
  ok: false;
  reason: "REPLAY";
  response: { status: number; body: unknown };
  cacheKey: string;
  lockKey: string;
  responseKey: string;
  backend: "redis" | "memory";
};

type BeginFailResult = {
  ok: false;
  reason: "INVALID_KEY" | "IN_PROGRESS";
  response: null;
  cacheKey: string;
  lockKey: string;
  responseKey: string;
  backend: "redis" | "memory";
};

type BeginResult = BeginNewResult | BeginReplayResult | BeginFailResult;

type IdempotencyToken = {
  cacheKey: string;
  lockKey: string;
  responseKey: string;
  backend: "redis" | "memory";
};

const RESPONSE_CACHE = new Map<string, CacheEntry>();
const LOCKS = new Map<string, number>();
const DEFAULT_RESPONSE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_LOCK_TTL_MS = 30 * 1000;

function now() {
  return Date.now();
}

function cleanupMemory() {
  const ts = now();
  for (const [key, value] of RESPONSE_CACHE.entries()) {
    if (value.expiresAt <= ts) RESPONSE_CACHE.delete(key);
  }
  for (const [key, expiresAt] of LOCKS.entries()) {
    if (expiresAt <= ts) LOCKS.delete(key);
  }
}

function buildCacheKey(scope: string, key: string) {
  return `idem:${scope}:${key}`;
}

function parseResponsePayload(payload: string) {
  try {
    return JSON.parse(payload) as { status: number; body: unknown };
  } catch {
    return null;
  }
}

export function getIdempotencyKey(request: Request) {
  return request.headers.get("x-idempotency-key")?.trim() ?? "";
}

export async function beginIdempotentRequest(opts: {
  scope: string;
  key: string;
  responseTtlMs?: number;
  lockTtlMs?: number;
}): Promise<BeginResult> {
  const key = opts.key;
  if (!key || key.length < 8 || key.length > 128) {
    return {
      ok: false,
      reason: "INVALID_KEY",
      response: null,
      cacheKey: "",
      lockKey: "",
      responseKey: "",
      backend: "memory",
    };
  }

  const cacheKey = buildCacheKey(opts.scope, key);
  const lockKey = `${cacheKey}:lock`;
  const responseKey = `${cacheKey}:response`;
  const lockTtlMs = opts.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;

  const redis = getRedisClient();
  if (redis) {
    try {
      const acquired = await redis.set(lockKey, "1", "PX", lockTtlMs, "NX");
      if (acquired === "OK") {
        return {
          ok: true,
          reason: "NEW",
          response: null,
          cacheKey,
          lockKey,
          responseKey,
          backend: "redis",
        };
      }

      const payload = await redis.get(responseKey);
      const parsed = payload ? parseResponsePayload(payload) : null;
      if (parsed) {
        return {
          ok: false,
          reason: "REPLAY",
          response: parsed,
          cacheKey,
          lockKey,
          responseKey,
          backend: "redis",
        };
      }
      return {
        ok: false,
        reason: "IN_PROGRESS",
        response: null,
        cacheKey,
        lockKey,
        responseKey,
        backend: "redis",
      };
    } catch {
      // Fall back to memory mode if Redis is temporarily unavailable.
    }
  }

  cleanupMemory();
  const lockExpiresAt = LOCKS.get(lockKey);
  if (!lockExpiresAt || lockExpiresAt <= now()) {
    LOCKS.set(lockKey, now() + lockTtlMs);
    return {
      ok: true,
      reason: "NEW",
      response: null,
      cacheKey,
      lockKey,
      responseKey,
      backend: "memory",
    };
  }

  const existing = RESPONSE_CACHE.get(responseKey);
  if (existing && existing.expiresAt > now()) {
    return {
      ok: false,
      reason: "REPLAY",
      response: { status: existing.status, body: existing.body },
      cacheKey,
      lockKey,
      responseKey,
      backend: "memory",
    };
  }

  return {
    ok: false,
    reason: "IN_PROGRESS",
    response: null,
    cacheKey,
    lockKey,
    responseKey,
    backend: "memory",
  };
}

export async function commitIdempotentResponse(opts: {
  token: IdempotencyToken;
  status: number;
  body: unknown;
  responseTtlMs?: number;
}) {
  const ttlMs = opts.responseTtlMs ?? DEFAULT_RESPONSE_TTL_MS;

  if (opts.token.backend === "redis") {
    const redis = getRedisClient();
    if (redis) {
      try {
        const payload = JSON.stringify({ status: opts.status, body: opts.body });
        await redis
          .multi()
          .set(opts.token.responseKey, payload, "PX", ttlMs)
          .del(opts.token.lockKey)
          .exec();
        return;
      } catch {
        // Fall through to memory fallback.
      }
    }
  }

  cleanupMemory();
  RESPONSE_CACHE.set(opts.token.responseKey, {
    status: opts.status,
    body: opts.body,
    expiresAt: now() + ttlMs,
  });
  LOCKS.delete(opts.token.lockKey);
}

export async function releaseIdempotentLock(token: IdempotencyToken) {
  if (!token.lockKey) return;
  if (token.backend === "redis") {
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.del(token.lockKey);
        return;
      } catch {
        // Fall through to memory fallback.
      }
    }
  }
  LOCKS.delete(token.lockKey);
}
