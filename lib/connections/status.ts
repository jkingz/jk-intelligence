import { SOURCES, type Source } from "@/types/metrics";
import type { DashboardClient } from "@/types/dashboard";
import type { ClientConnections, CredentialRow } from "@/types/connections";

/**
 * Pairs the RLS-visible client list with the RLS-visible credential rows. Both
 * inputs are already tenant-scoped by Postgres; this function's only contract
 * is that an unexpected clientId in `rows` produces nothing, so a future
 * service-role read could not leak through the render.
 */
export function buildConnectionStates(
  clients: DashboardClient[],
  rows: CredentialRow[],
): ClientConnections[] {
  const byClient = new Map<string, Map<Source, string>>();
  for (const client of clients) byClient.set(client.id, new Map());

  for (const row of rows) {
    const bucket = byClient.get(row.clientId);
    if (!bucket) continue;
    const existing = bucket.get(row.source);
    if (existing === undefined || row.linkedAt < existing) {
      bucket.set(row.source, row.linkedAt);
    }
  }

  return clients.map((client) => {
    const bucket = byClient.get(client.id)!;
    const sources = SOURCES.filter((source) => bucket.has(source)).map((source) => ({
      source,
      linkedAt: bucket.get(source)!,
    }));
    return { client, sources };
  });
}
