import { toCsv } from "@/lib/exports/csv";
import { exportFilename } from "@/lib/exports/filename";
import { loadExportDataset } from "@/lib/exports/server";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/exports/[clientId]/csv">,
) {
  const { clientId } = await ctx.params;
  const result = await loadExportDataset(request, clientId);
  if (!result.ok) return result.response;

  const body = toCsv(result.dataset);
  const filename = exportFilename(
    result.dataset.client.name,
    result.dataset.days,
    "metrics",
  );
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      Vary: "Cookie",
    },
  });
}
