/**
 * Worker-side bridge to Next cache invalidation. The BullMQ worker runs as a
 * standalone process where `revalidateTag` is unavailable (it requires a Next
 * request store), so after a job completes it pokes the internal
 * `/api/revalidate/dashboard` route with the cron secret instead.
 *
 * No-ops when the app URL or secret is not configured (local dev / pre-deploy).
 */
export async function notifyDashboardRevalidated(): Promise<void> {
  const url = resolveAppUrl();
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) return;

  try {
    const response = await fetch(`${url}/api/revalidate/dashboard`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    if (!response.ok) {
      console.error("cache_invalidate_status", response.status);
    }
  } catch (error) {
    console.error(
      "cache_invalidate_failed",
      error instanceof Error ? error.message : error,
    );
  }
}

function resolveAppUrl(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_APP_URL as string | undefined;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL as string | undefined;
  if (vercelUrl) return `https://${vercelUrl}`;
  return undefined;
}