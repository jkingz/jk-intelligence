import { Suspense } from "react";

import { Dashboard, DashboardSkeleton } from "@/components/features/dashboard";
import { AccountMenu, getProfileView } from "@/components/features/user-profile";
import {
  getCachedDashboardOverview,
  getCachedKeywordHistory,
  listAccessibleClients,
} from "@/lib/db/repository";
import { isDashboardRange, type DashboardRange } from "@/types/dashboard";

const DEFAULT_RANGE: DashboardRange = 30;

type DashboardSearchParams = Promise<{ client?: string; days?: string }>;

export default function Page({ searchParams }: { searchParams: DashboardSearchParams }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardData({ searchParams }: { searchParams: DashboardSearchParams }) {
  const [profile, params] = await Promise.all([getProfileView(), searchParams]);

  const clients = await listAccessibleClients({
    role: profile?.role ?? null,
    clientId: profile?.clientId ?? null,
  });

  const selectedClient =
    clients.find((client) => client.id === params.client) ?? clients[0] ?? null;

  const requestedDays = Number(params.days);
  const days: DashboardRange = isDashboardRange(requestedDays) ? requestedDays : DEFAULT_RANGE;

  const [overview, history] = selectedClient
    ? await Promise.all([
        getCachedDashboardOverview(selectedClient, days),
        getCachedKeywordHistory(selectedClient, days),
      ])
    : [null, [] as Awaited<ReturnType<typeof getCachedKeywordHistory>>];

  return (
    <Dashboard
      accountMenu={<AccountMenu profile={profile} />}
      clients={clients}
      selectedClient={selectedClient}
      days={days}
      overview={overview}
      history={history}
    />
  );
}
