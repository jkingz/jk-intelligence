"use client";

import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { DASHBOARD_RANGES, DashboardOverview, DashboardRange, isDashboardRange } from "@/types/dashboard";

interface DashboardHeroProps {
  overview: DashboardOverview;
  days: DashboardRange;
  switching: boolean;
  onDaysChange: (days: DashboardRange) => void;
}

const ranges = DASHBOARD_RANGES.map((days) => ({ value: String(days), label: `Last ${days} days` }));

export function DashboardHero({ overview, days, switching, onDaysChange }: DashboardHeroProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4 border-b border-default pb-4">
        <div className="min-w-0">
          <p className="text-xs text-text-muted tracking-wide mb-1 font-mono uppercase">
            {overview.client.domain} · Organic Performance Report · {overview.dateRange}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-text-primary tracking-tight font-normal">
            Organic momentum {overview.growth < 0 ? "down" : "up"} <span className="italic font-normal text-primary">{Math.abs(overview.growth).toFixed(1)}%</span> over {days} days.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <Select
            items={ranges}
            value={String(days)}
            onValueChange={(value) => {
              const next = Number(value);
              if (value !== null && isDashboardRange(next)) onDaysChange(next);
            }}
          >
            <SelectTrigger
              aria-label="Reporting date range"
              className="w-36 text-xs h-8"
              loading={switching}
            >
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ranges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <TabsList aria-label="Dashboard sections" className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="queries" className="text-xs">Queries</TabsTrigger>
            <TabsTrigger value="ai_visibility" className="text-xs">AI Citation</TabsTrigger>
          </TabsList>
        </div>
      </div>
      {overview.staleSource && (
        <div role="status" className="bg-state-warning/10 border border-state-warning text-state-warning rounded-xl px-4 py-2 text-xs">
          Data from {overview.lastUpdated} — last sync failed. Showing cached results.
        </div>
      )}
    </section>
  );
}
