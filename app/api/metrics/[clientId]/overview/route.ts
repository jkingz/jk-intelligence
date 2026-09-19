import { z } from "zod";

import { enforceClientAccess } from "@/lib/agents/authAgent";
import {
  getCachedDashboardOverview,
  getCachedKeywordHistory,
  listAccessibleClients,
} from "@/lib/db/repository";
import { getProfileView } from "@/components/features/user-profile";
import {
  DASHBOARD_RANGES,
  isDashboardRange,
  type DashboardRange,
} from "@/types/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientIdSchema = z.uuid();

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/metrics/[clientId]/overview">,
) {
  const { clientId: rawClientId } = await ctx.params;
  const clientId = clientIdSchema.safeParse(rawClientId);
  if (!clientId.success) {
    return Response.json("Invalid client id", { status: 400 });
  }

  const access = await enforceClientAccess(clientId.data);
  if (!access.allow) {
    const status = access.reason === "unauthenticated" ? 401 : 403;
    return Response.json("Forbidden", { status });
  }

  const profile = await getProfileView();
  const clients = await listAccessibleClients({
    role: profile?.role ?? null,
    clientId: profile?.clientId ?? null,
  });
  const client = clients.find((c) => c.id === clientId.data) ?? null;
  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
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
    return Response.json({ overview, history });
  } catch {
    return Response.json(
      { error: "Database operation failed" },
      { status: 503 },
    );
  }
}

const DEFAULT_DAYS: DashboardRange = DASHBOARD_RANGES[0];
