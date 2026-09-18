import { z } from "zod";
import { enforceClientAccess } from "@/lib/agents/authAgent";
import { listKeywordRankings } from "@/lib/db/repository";
import { SOURCES, type Source } from "@/types/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const clientIdSchema = z.uuid();
const querySchema = z.object({
  source: z.enum(SOURCES).default("gsc"),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/metrics/[clientId]/keywords">,
) {
  const { clientId: rawClientId } = await ctx.params;
  const clientId = clientIdSchema.safeParse(rawClientId);
  if (!clientId.success) {
    return Response.json({ error: "Invalid client id" }, { status: 400 });
  }

  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", meta: { issues: query.error.issues } },
      { status: 400 },
    );
  }

  const access = await enforceClientAccess(clientId.data);
  if (!access.allow) {
    const status = access.reason === "unauthenticated" ? 401 : 403;
    return Response.json({ error: "Forbidden" }, { status });
  }

  const now = new Date();
  const from = query.data.from ?? new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const to = query.data.to ?? now.toISOString();

  try {
    const data = await listKeywordRankings(
      clientId.data,
      query.data.source as Source,
      from,
      to,
    );
    return Response.json({
      data,
      meta: {
        clientId: clientId.data,
        source: query.data.source,
        from,
        to,
        count: data.length,
      },
    });
  } catch {
    return Response.json({ error: "Database operation failed" }, { status: 503 });
  }
}