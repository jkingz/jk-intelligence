import { verifyCronSecret } from "@/lib/auth/cron";
import { revalidateDashboardOverview } from "@/lib/cache/invalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal endpoint the sync worker pokes after a job completes so
 * `dashboard-overview` tagged caches do not trail a sync (the worker process
 * cannot call `revalidateTag` itself). Guarded by the same cron secret as
 * `/api/cron/sync`.
 */
export async function POST(request: Request) {
  const verdict = verifyCronSecret(request, process.env.CRON_SECRET);
  if (verdict === "unavailable") {
    return Response.json({ error: "Cron unavailable" }, { status: 503 });
  }
  if (verdict === "denied") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateDashboardOverview();
  return Response.json({ revalidated: true, tag: "dashboard-overview" }, { status: 200 });
}