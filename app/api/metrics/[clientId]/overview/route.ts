import { z } from "zod";

import { getAuthUser } from "@/lib/agents/authAgent";
import {
  getCachedDashboardOverview,
  getCachedKeywordHistory,
  listAccessibleClients,
} from "@/lib/db/repository";
import {
  DASHBOARD_RANGES,
  isDashboardRange,
  type DashboardRange,
} from "@/types/dashboard";

const clientIdSchema = z.uuid();

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/metrics/[clientId]/overview">,
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

  const user = await getAuthUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Cookie'
      }
    });
  }

  const clients = await listAccessibleClients({
    role: user.role,
    clientId: user.clientId,
  });
  const client = clients.find((c) => c.id === clientId.data) ?? null;
  if (!client) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Cookie'
      }
    });
  }

  const rawDays = Number(
    new URL(request.url).searchParams.get("days") ?? DEFAULT_DAYS,
  );
  const days: DashboardRange = isDashboardRange(rawDays)
    ? rawDays
    : DEFAULT_DAYS;

  try {
    const [overview, history] = await Promise.all([
      getCachedDashboardOverview(client, days),
      getCachedKeywordHistory(client, days),
    ]);
    return new Response(JSON.stringify({ overview, history }), {
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

const DEFAULT_DAYS: DashboardRange = DASHBOARD_RANGES[0];
