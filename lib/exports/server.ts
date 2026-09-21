import "server-only";

import { z } from "zod";

import { getAuthUser } from "@/lib/agents/authAgent";
import { buildExportDataset } from "@/lib/exports/dataset";
import { listAccessibleClients, listAllMetricSnapshots } from "@/lib/db/repository";
import {
  DASHBOARD_RANGES,
  isDashboardRange,
  type DashboardRange,
} from "@/types/dashboard";

const DAY_MS = 86_400_000;
const DEFAULT_DAYS: DashboardRange = DASHBOARD_RANGES[0];

export type ExportResult =
  | { ok: true; dataset: Awaited<ReturnType<typeof buildExportDataset>> }
  | { ok: false; response: Response };

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Cookie",
    },
  });
}

/**
 * Auth + ownership + bounded read shared by both export routes — same access
 * model as `/api/metrics/[clientId]/overview`. `days` outside `7 | 30 | 90`
 * is a 400 here (unlike the overview route, which silently defaults) because
 * an export must state the window it covers.
 */
export async function loadExportDataset(
  request: Request,
  rawClientId: string,
): Promise<ExportResult> {
  const clientId = z.uuid().safeParse(rawClientId);
  if (!clientId.success) {
    return { ok: false, response: jsonError("Invalid client id", 400) };
  }

  const params = new URL(request.url).searchParams;
  const rawDays = Number(params.get("days") ?? DEFAULT_DAYS);
  if (!isDashboardRange(rawDays)) {
    return { ok: false, response: jsonError("Invalid days", 400) };
  }
  const days: DashboardRange = rawDays;

  const user = await getAuthUser();
  if (!user) {
    return { ok: false, response: jsonError("Forbidden", 401) };
  }

  const clients = await listAccessibleClients({
    role: user.role,
    clientId: user.clientId,
  });
  const client = clients.find((entry) => entry.id === clientId.data) ?? null;
  if (!client) {
    return { ok: false, response: jsonError("Forbidden", 403) };
  }

  const now = new Date();
  try {
    const snapshots = await listAllMetricSnapshots(
      client.id,
      new Date(now.getTime() - days * 2 * DAY_MS).toISOString(),
      now.toISOString(),
    );
    return {
      ok: true,
      dataset: buildExportDataset({ client, days, snapshots, now }),
    };
  } catch {
    return { ok: false, response: jsonError("Database operation failed", 503) };
  }
}
