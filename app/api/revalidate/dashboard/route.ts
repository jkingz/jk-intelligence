import { verifyCronSecret } from "@/lib/auth/cron";
import { revalidateDashboardOverview } from "@/lib/cache/invalidate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const verdict = verifyCronSecret(request, process.env.CRON_SECRET);
  if (verdict === "unavailable") {
    return Response.json({ error: "Cron unavailable" }, { status: 503 });
  }
  if (verdict === "denied") {
    return Response.json({ status: 401 });
  }

  revalidateDashboardOverview();
  return Response.json({ revalidated: true, tag: "dashboard-overview" }, { status: 200 });
}