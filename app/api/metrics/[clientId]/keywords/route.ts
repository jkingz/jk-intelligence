import { z } from "zod";

import { enforceClientAccess } from "@/lib/agents/authAgent";
import { listKeywordRankings } from "@/lib/db/repository";
import { SOURCES, type Source } from "@/types/metrics";

export const runtime = "nodejs";

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
    return new Response(JSON.stringify({ error: "Invalid client id" }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Cookie'
      }
    });
  }

  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return new Response(JSON.stringify({ error: "Invalid query", meta: { issues: query.error.issues } }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Cookie'
      }
    });
  }

  const access = await enforceClientAccess(clientId.data);
  if (!access.allow) {
    const status = access.reason === "unauthenticated" ? 401 : 403;
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Cookie'
      }
    });
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
    return new Response(JSON.stringify({
      data,
      meta: {
        clientId: clientId.data,
        source: query.data.source,
        from,
        to,
        count: data.length,
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        'Vary': 'Cookie'
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Database operation failed" }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Cookie'
      }
    });
  }
}