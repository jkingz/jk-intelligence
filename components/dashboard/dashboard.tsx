"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

import { DashboardHeader } from "./dashboard-header";
import { DashboardHero } from "./dashboard-hero";
import { DashboardMetrics } from "./dashboard-metrics";
import { DashboardChart } from "./dashboard-chart";
import { AutonomousBrief } from "./autonomous-brief";
import { QueryTable } from "./query-table";
import { AICitationGrid } from "./ai-citation-grid";
import { demoClients, getMockOverview } from "@/lib/mock-dashboard";
import { Tabs, TabsContent } from "@/components/ui/tabs";

const emptySubscribe = () => () => {};

export default function Dashboard() {
  const [selectedClient, setSelectedClient] = useState(demoClients[0]);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState("overview");
  const overview = getMockOverview(selectedClient.id, days);
  const [syncing, setSyncing] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const { resolvedTheme, setTheme } = useTheme();

  const handleManualSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 800);
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col font-sans antialiased bg-background text-foreground">
      <DashboardHeader
        selectedClient={selectedClient}
        overview={overview}
        onSelectClient={setSelectedClient}
        syncing={syncing}
        onSync={handleManualSync}
        mounted={mounted}
        theme={resolvedTheme}
        onToggleTheme={toggleTheme}
      />
      <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6 sm:gap-8">
          <DashboardHero overview={overview} days={days} onDaysChange={setDays} />
          <TabsContent value="overview" className="flex flex-col gap-6 sm:gap-8">
            <DashboardMetrics overview={overview} />
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <DashboardChart data={overview.traffic} />
              <AutonomousBrief overview={overview} />
            </section>
            <QueryTable key={selectedClient.id} keywords={overview.keywords} />
            <AICitationGrid selectedClient={selectedClient} citations={overview.aiCitations} />
          </TabsContent>
          <TabsContent value="queries">
            <QueryTable key={selectedClient.id} keywords={overview.keywords} />
          </TabsContent>
          <TabsContent value="ai_visibility">
            <AICitationGrid selectedClient={selectedClient} citations={overview.aiCitations} />
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
