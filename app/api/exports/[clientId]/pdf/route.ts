import { json, NO_STORE } from "@/lib/api/guard";
import { exportFilename } from "@/lib/exports/filename";
import { renderPdfReport } from "@/lib/exports/pdf";
import { loadExportDataset } from "@/lib/exports/server";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/exports/[clientId]/pdf">,
) {
  const { clientId } = await ctx.params;
  const result = await loadExportDataset(request, clientId);
  if (!result.ok) return result.response;

  let pdf: Uint8Array;
  try {
    pdf = await renderPdfReport(result.dataset);
  } catch {
    return json({ error: "Report rendering failed" }, 503);
  }
  const filename = exportFilename(
    result.dataset.client.name,
    result.dataset.days,
    "report",
  );
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...NO_STORE,
    },
  });
}
