import { NextResponse } from "next/server";
import { z } from "zod";

import { getProfileView } from "@/components/features/user-profile/lib/profile";
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

const NO_STORE = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

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
    return NextResponse.json({ error: "Invalid client id" }, { status: 400, headers: NO_STORE });
  }

  const rawDays = Number(params.get("days") ?? DEFAULT_DAYS);
  const days: DashboardRange = isDashboardRange(rawDays) ? rawDays : DEFAULT_DAYS;

  const profile = await getProfileView();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const clients = await listAccessibleClients(profile);
    const client = clients.find((entry) => entry.id === rawClientId) ?? clients[0] ?? null;
    if (!client) {
      return NextResponse.json({ profile, clients, selection: null }, { headers: NO_STORE });
    }

    const [overview, history] = await Promise.all([
      getCachedDashboardOverview(client, days),
      getCachedKeywordHistory(client, days),
    ]);

    return NextResponse.json(
      {
        profile,
        clients,
        selection: {
          clientId: client.id,
          days,
          payload: { overview, history },
        },
      },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json({ error: "Database operation failed" }, { status: 503, headers: NO_STORE });
  }
}
