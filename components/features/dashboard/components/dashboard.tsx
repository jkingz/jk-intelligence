"use client";

import React, {
  Suspense,
  useState,
  useEffect,
  startTransition,
  addTransitionType,
  Activity,
  ViewTransition,
} from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";

import { toast } from "@/components/ui/toast";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import {
  readDashboardTab,
  withDashboardParams,
} from "@/lib/dashboard/url-state";
import { DashboardHeader } from "./dashboard-header";
import { DashboardHero } from "./dashboard-hero";
import { DashboardMetrics } from "./dashboard-metrics";
import dynamic from "next/dynamic";
import { DashboardChartFallback } from "./dashboard-chart-fallback";

const DashboardChart = dynamic(
  () => import("./dashboard-chart").then((m) => ({ default: m.DashboardChart })),
  { loading: () => <DashboardChartFallback /> }
);
import { AutonomousBrief } from "./autonomous-brief";
import { QueryTable } from "./query-table";
import { AICitationGrid } from "./ai-citation-grid";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  DASHBOARD_TABS,
  isDashboardTab,
  type DashboardClient,
  type DashboardOverview,
  type DashboardRange,
  type DashboardTab,
  type KeywordRankSeries,
} from "@/types/dashboard";

interface PendingDashboardNav {
  clientId: string;
  days: DashboardRange;
  toastId: string;
}

let pendingDashboardNav: PendingDashboardNav | null = null;

const panelTransition: React.ComponentProps<typeof ViewTransition> = {
  enter: {
    forward: "vt-enter-forward",
    backward: "vt-enter-backward",
    default: "vt-fade",
  },
  exit: {
    forward: "vt-exit-forward",
    backward: "vt-exit-backward",
    default: "vt-fade",
  },
  default: "none",
};

function AnimatedPanel({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Activity mode={active ? "visible" : "hidden"}>
      <ViewTransition {...panelTransition}>
        <div className={className}>{children}</div>
      </ViewTransition>
    </Activity>
  );
}

function EmptyShell({ accountMenu, message }: { accountMenu?: React.ReactNode; message: string }) {
  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col font-sans antialiased bg-background text-foreground">
      <header className="border-b border-default bg-surface">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <span className="font-serif text-base sm:text-lg tracking-tight font-medium">JK Intelligence</span>
          {accountMenu}
        </div>
      </header>
      <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <Card>
          <CardContent className="py-12 text-center text-sm text-text-muted">{message}</CardContent>
        </Card>
      </main>
    </div>
  );
}

interface DashboardProps {
  accountMenu?: React.ReactNode;
  exportMenu?: React.ReactNode;
  clients: DashboardClient[];
  selectedClient: DashboardClient | null;
  days: DashboardRange;
  overview: DashboardOverview | null;
  history: KeywordRankSeries[];
}

export default function Dashboard({
  accountMenu,
  exportMenu,
  clients,
  selectedClient,
  days,
  overview,
  history,
}: DashboardProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    readDashboardTab(searchParams.toString()),
  );
  const [syncing, setSyncing] = useState(false);
  const [pendingView, setPendingView] = useState<{
    clientId: string;
    days: DashboardRange;
  } | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!pendingDashboardNav) return;
    if (
      pendingDashboardNav.clientId === selectedClient?.id &&
      pendingDashboardNav.days === days
    ) {
      const { toastId } = pendingDashboardNav;
      pendingDashboardNav = null;
      finishStatusToast(toastId, {
        status: "success",
        title: "Dashboard updated",
        description: `Loaded ${selectedClient?.name ?? "client"} · Last ${days} days.`,
      });
    }
  }, [selectedClient, days]);

  if (!selectedClient) {
    return (
      <EmptyShell
        accountMenu={accountMenu}
        message="No reporting client is assigned to your account yet."
      />
    );
  }

  if (!overview) {
    return (
      <EmptyShell
        accountMenu={accountMenu}
        message={`No metrics have been synced for ${selectedClient.name} yet.`}
      />
    );
  }

  const navigate = (clientId: string, range: DashboardRange) => {
    if (pendingDashboardNav) toast.close(pendingDashboardNav.toastId);
    const url = `/dashboard${withDashboardParams(window.location.search, {
      client: clientId,
      days: range,
    })}`;
    const toastId = startStatusToast("Loading dashboard", "Fetching the latest data…");
    pendingDashboardNav = { clientId, days: range, toastId };
    setPendingView({ clientId, days: range });
    startTransition(() => {
      window.history.replaceState({}, "", url);
      router.replace(url, { scroll: false });
    });
  };

  const handleSelectClient = (client: DashboardClient) => {
    if (client.id === selectedClient.id) return;
    navigate(client.id, days);
  };

  const handleDaysChange = (range: DashboardRange) => {
    if (range === days) return;
    navigate(selectedClient.id, range);
  };

  const handleManualSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 800);
  };

  const handleTabChange = (value: string) => {
    if (!isDashboardTab(value) || value === activeTab) return;
    const direction =
      DASHBOARD_TABS.indexOf(value) > DASHBOARD_TABS.indexOf(activeTab) ? "forward" : "backward";
    // replaceState, not router.replace: every panel is already mounted, so a router
    // navigation here would spend an RSC round trip on each tab click.
    window.history.replaceState(
      {},
      "",
      `/dashboard${withDashboardParams(window.location.search, { tab: value })}`,
    );
    startTransition(() => {
      addTransitionType(direction);
      setActiveTab(value);
    });
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const switching =
    pendingView !== null &&
    (pendingView.clientId !== selectedClient.id || pendingView.days !== days);

  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col font-sans antialiased bg-background text-foreground">
      <DashboardHeader
        accountMenu={accountMenu}
        exportMenu={exportMenu}
        clients={clients}
        selectedClient={selectedClient}
        overview={overview}
        onSelectClient={handleSelectClient}
        syncing={syncing}
        switching={switching}
        onSync={handleManualSync}
        theme={resolvedTheme}
        onToggleTheme={toggleTheme}
      />
      <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-6 sm:gap-8">
          <DashboardHero
            overview={overview}
            days={days}
            switching={switching}
            onDaysChange={handleDaysChange}
          />
          <TabsContent value="overview" keepMounted>
            <AnimatedPanel active={activeTab === "overview"} className="flex flex-col gap-6 sm:gap-8">
              <DashboardMetrics overview={overview} />
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Suspense fallback={<DashboardChartFallback />}>
                  <DashboardChart data={overview.traffic} />
                </Suspense>
                <AutonomousBrief overview={overview} />
              </section>
              <QueryTable key={selectedClient.id} keywords={overview.keywords} history={history} />
              <AICitationGrid selectedClient={selectedClient} citations={overview.aiCitations} />
            </AnimatedPanel>
          </TabsContent>
          <TabsContent value="queries" keepMounted>
            <AnimatedPanel active={activeTab === "queries"}>
              <QueryTable key={selectedClient.id} keywords={overview.keywords} history={history} />
            </AnimatedPanel>
          </TabsContent>
          <TabsContent value="ai_visibility" keepMounted>
            <AnimatedPanel active={activeTab === "ai_visibility"}>
              <AICitationGrid selectedClient={selectedClient} citations={overview.aiCitations} />
            </AnimatedPanel>
          </TabsContent>
        </Tabs>
      </main>
      <footer className="border-t border-default bg-surface py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-medium text-text-primary">JK Intelligence</span>
            <span>— Agency SEO & AI Visibility System</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <span>{overview.freshness}</span>
            <span>Updated: {overview.lastUpdated}</span>
            <span>{overview.dateRange}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
