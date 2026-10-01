import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_UPCOMING,
  SUPPORTED_SOURCES,
  UPCOMING_PROVIDERS,
  connectionStatusLabel,
} from "../lib/catalog";
import { ConnectionRow } from "./connection-row";
import type { ClientConnections } from "@/types/connections";

export function ConnectionsPage({ connections }: { connections: ClientConnections[] }) {
  return (
    <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight font-medium">
          Connections
        </h1>
        <p className="max-w-prose text-sm text-text-muted">
          Which data sources each reporting client has linked. Linking is recorded by
          your account team for now: fetching stays offline until a sync worker is
          hosted, so this page reports status and takes no credentials.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {connections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-text-muted">
              No reporting client is assigned to your account yet.
            </CardContent>
          </Card>
        ) : (
          connections.map((entry) => (
            <Card key={entry.client.id}>
              <CardHeader>
                <CardTitle className="text-base">{entry.client.name}</CardTitle>
                <p className="text-xs text-text-faint">{entry.client.domain}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {SUPPORTED_SOURCES.map((supported) => {
                  const match = entry.sources.find(
                    (source) => source.source === supported.source,
                  );
                  return (
                    <ConnectionRow
                      key={supported.source}
                      label={supported.label}
                      detail={supported.detail}
                      status={connectionStatusLabel(match?.linkedAt ?? null)}
                    />
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not available yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {UPCOMING_PROVIDERS.map((provider) => (
              <ConnectionRow
                key={provider.id}
                label={provider.label}
                detail={provider.reason}
                status={STATUS_UPCOMING}
                showConnectButton={false}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
