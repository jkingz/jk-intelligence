import { z } from "zod";

import { getProfileView } from "@/components/features/user-profile/lib/profile";
import { badRequest, databaseFailure, gateNullable, json } from "@/lib/api/guard";
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

export const revalidate = 0; // user-specific, always fresh

const DEFAULT_DAYS: DashboardRange = DASHBOARD_RANGES[0];

/**
 * Everything the dashboard needs to paint, in one request: identity, the
 * accessible client list, and the overview payload for the initial selection.
 *
 * The dashboard page shell is statically prerendered, so its data arrives
 * client-side after login. Splitting this across `/api/me` + `/api/clients` +
 * `/api/metrics/[clientId]/overview` serialized three round trips (each with
 * its own auth reads) behind a blank screen.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawClientId = params.get("client");
  if (rawClientId !== null && !z.uuid().safeParse(rawClientId).success) {
    return badRequest("Invalid client id");
  }

  const rawDays = Number(params.get("days") ?? DEFAULT_DAYS);
  const days: DashboardRange = isDashboardRange(rawDays) ? rawDays : DEFAULT_DAYS;

  const gate = await gateNullable(getProfileView);
  if (!gate.allow) return gate.response;

  try {
    const clients = await listAccessibleClients();
    const client = clients.find((entry) => entry.id === rawClientId) ?? clients[0] ?? null;
    if (!client) {
      return json({ profile: gate.value, clients, selection: null }, 200);
    }

    const [overview, history] = await Promise.all([
      getCachedDashboardOverview(client, days),
      getCachedKeywordHistory(client, days),
    ]);

    return json(
      {
        profile: gate.value,
        clients,
        selection: {
          clientId: client.id,
          days,
          payload: { overview, history },
        },
      },
      200,
    );
  } catch {
    return databaseFailure();
  }
}
