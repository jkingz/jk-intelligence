"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { TrendingUp, Globe2, Bot, Activity, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Overview } from "./dashboard-data";

interface Metric {
  title: string;
  value: string;
  change: number;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
  footerText: string;
}

export function DashboardMetrics({ overview }: { overview: Overview }) {
  const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  const metrics: Metric[] = [
    {
      title: `Total Clicks (${overview.days}d)`,
      value: overview.clicks.toLocaleString("en-US"),
      change: overview.growth,
      delta: `${signed(overview.growth)}%`,
      icon: TrendingUp,
      footerText: `vs ${overview.previous.toLocaleString("en-US")} in previous ${overview.days} days`,
    },
    {
      title: "Impressions",
      value: overview.impressions.toLocaleString("en-US"),
      change: overview.impressionsGrowth,
      delta: `${signed(overview.impressionsGrowth)}%`,
      icon: Globe2,
      footerText: `CTR ${overview.ctr.toFixed(2)}% · ${overview.conversions.toLocaleString("en-US")} conversions`,
    },
    {
      title: "AI Search Engine Citations",
      value: overview.aiCitations.reduce((total, citation) => total + citation.count, 0).toLocaleString("en-US"),
      change: overview.aiGrowth,
      delta: `${signed(overview.aiGrowth)}%`,
      icon: Bot,
      footerText: `Demo proxy: AI referrals vs previous ${overview.days} days`,
    },
    {
      title: "Avg Position (Tracked Keywords)",
      value: overview.averagePosition.toFixed(1),
      change: overview.positionChange,
      delta: `${Math.abs(overview.positionChange).toFixed(1)} pos ${overview.positionChange > 0 ? "gained" : overview.positionChange < 0 ? "lost" : "changed"}`,
      icon: Activity,
      footerText: `${overview.topThreeCount} in Top 3 · ${overview.gainedTopThree} newly entered`,
    },
  ];

  return (
    <section aria-label="Performance metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const DeltaIcon = metric.change > 0 ? ArrowUpRight : metric.change < 0 ? ArrowDownRight : Minus;
        return (
          <Card key={metric.title} className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <CardHeader className="p-0 flex flex-row items-center justify-between text-xs text-text-muted">
              <span>{metric.title}</span>
              <metric.icon className="size-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-0 py-2 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-mono font-medium tracking-tight text-text-primary">{metric.value}</span>
              <span className={cn("inline-flex items-center text-xs font-medium", metric.change > 0 ? "text-state-success" : metric.change < 0 ? "text-state-error" : "text-text-muted")}>
                <DeltaIcon className="size-3" aria-hidden="true" />
                {metric.delta}
              </span>
            </CardContent>
            <CardFooter className="p-0 text-[11px] text-text-muted border-none bg-transparent">
              {metric.footerText}
            </CardFooter>
          </Card>
        );
      })}
    </section>
  );
}
