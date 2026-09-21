import "server-only";

import { Redis } from "@upstash/redis";

import { SlidingWindowLimiter } from "@/lib/rate-limit";

export const EXPORT_QUOTA = { max: 6, windowMs: 60_000 } as const;

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redis = url && token ? new Redis({ url, token }) : null;
  }
  return redis;
}

/**
 * Per-user limiter used when Redis is unconfigured or unreachable. It only
 * bounds one instance, so it is a floor, not the primary control — the shared
 * counter above is what stops direct API abuse across serverless instances.
 */
const localLimiters = new Map<string, SlidingWindowLimiter>();

function decideLocal(userId: string, now: number): QuotaDecision {
  if (localLimiters.size > 1000) localLimiters.clear();
  let limiter = localLimiters.get(userId);
  if (!limiter) {
    limiter = new SlidingWindowLimiter(EXPORT_QUOTA);
    localLimiters.set(userId, limiter);
  }
  return limiter.trySubmit(now)
    ? { allowed: true }
    : { allowed: false, retryAfterSeconds: ceilSeconds(limiter.retryAfter(now)) };
}

function ceilSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/**
 * Fixed-window export budget for one user, shared across instances. Only the
 * first request of a window sets the TTL — refreshing it on every request would
 * let sustained traffic slide the window forever and lock the user out.
 */
export async function consumeExportQuota(userId: string): Promise<QuotaDecision> {
  const now = Date.now();
  const windowId = Math.floor(now / EXPORT_QUOTA.windowMs);
  const client = getRedis();
  if (!client) return decideLocal(userId, now);

  try {
    const count = await client.incr(`export-quota:${userId}:${windowId}`);
    if (count === 1) {
      await client.expire(
        `export-quota:${userId}:${windowId}`,
        Math.ceil(EXPORT_QUOTA.windowMs / 1000),
      );
    }
    if (count <= EXPORT_QUOTA.max) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: ceilSeconds(
        (windowId + 1) * EXPORT_QUOTA.windowMs - now,
      ),
    };
  } catch {
    return decideLocal(userId, now);
  }
}
