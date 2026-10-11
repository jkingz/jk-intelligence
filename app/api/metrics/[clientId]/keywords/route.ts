import { z } from "zod";

import {
  badRequest,
  databaseFailure,
  gateClientAccess,
  gateSession,
  json,
} from "@/lib/api/guard";
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
  if (!clientId.success) return badRequest("Invalid client id");

  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return json(
      { error: "Invalid query", meta: { issues: query.error.issues } },
      400,
    );
  }

  const now = new Date();
  const from = query.data.from ?? new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const to = query.data.to ?? now.toISOString();

  const session = await gateSession();
  if (!session.allow) return session.response;

  const access = await gateClientAccess(clientId.data);
  if (!access.allow) return access.response;

  try {
    const data = await listKeywordRankings(
      clientId.data,
      query.data.source as Source,
      from,
      to,
    );
    return json(
      {
        data,
        meta: {
          clientId: clientId.data,
          source: query.data.source,
          from,
          to,
          count: data.length,
        },
      },
      200,
    );
  } catch {
    return databaseFailure();
  }
}
