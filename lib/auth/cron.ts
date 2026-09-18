import { timingSafeEqual } from "node:crypto";

export type CronAuthVerdict = "ok" | "unavailable" | "denied";

/**
 * Pure, framework-free cron authorization check. Vercel cron sends
 * `Authorization: Bearer <CRON_SECRET>` when the secret is configured on the
 * project, so a request without the secret (or without the env var) is never
 * allowed to enqueue sync work.
 */
export function verifyCronSecret(request: Request, secret: string | undefined): CronAuthVerdict {
  if (!secret) return "unavailable";
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return "denied";
  }
  return "ok";
}