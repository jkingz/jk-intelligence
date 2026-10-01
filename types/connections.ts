import type { DashboardClient } from "@/types/dashboard";
import type { Source } from "@/types/metrics";

export interface SourceConnection {
  source: Source;
  /** ISO timestamp from api_credentials.created_at — never the reference itself. */
  linkedAt: string;
}

export interface ClientConnections {
  client: DashboardClient;
  /** Sources with a credential row, in `SOURCES` order because `buildConnectionStates()`
   *  derives the array by filtering that tuple (`lib/connections/status.ts`) — the read's
   *  own arrival order carries no meaning and nothing sorts it. Absent means not connected. */
  sources: SourceConnection[];
}

/** A credential row keyed for joining, camelCase like the rest of the read layer. */
export interface CredentialRow {
  clientId: string;
  source: Source;
  linkedAt: string;
}
