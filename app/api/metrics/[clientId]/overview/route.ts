import { z } from "zod";

import {
  badRequest,
  databaseFailure,
  gateSession,
  json,
  resolveAccessibleClient,
} from "@/lib/api/guard";
import {
  getCachedDashboardOverview,
  getCachedKeywordHistory,
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
  if (!clientId.success) return badRequest("Invalid client id");

  const rawDays = Number(
    new URL(request.url).searchParams.get("days") ?? DEFAULT_DAYS,
  );
  const days: DashboardRange = isDashboardRange(rawDays)
    ? rawDays
    : DEFAULT_DAYS;

  const session = await gateSession();
  if (!session.allow) return session.response;

  const access = await resolveAccessibleClient(clientId.data);
  if (!access.allow) return access.response;

  try {
    const [overview, history] = await Promise.all([
      getCachedDashboardOverview(access.value, days),
      getCachedKeywordHistory(access.value, days),
    ]);
    return json({ overview, history }, 200);
  } catch {
    return databaseFailure();
  }
}

const DEFAULT_DAYS: DashboardRange = DASHBOARD_RANGES[0];
