"use client";

import React, { use, useState } from "react";
import { browser } from "react-dom";
import { useReducedMotion } from "motion/react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { InView } from "@/components/ui/in-view";
import { cn } from "@/lib/utils";
import { TrafficPoint } from "@/types/dashboard";

interface DashboardChartProps {
  data: TrafficPoint[];
}

export function DashboardChart({ data }: DashboardChartProps) {
  use(browser());
  const shouldReduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const isRevealed = revealed || shouldReduceMotion === true;
  const hasAiData = data.some((point) => point.aiReferrals > 0);

  return (
    <div className="relative lg:col-span-2 min-w-0">
      <InView once onChange={setRevealed}>
        <div
          className={cn(
            "relative bg-surface rounded-xl border border-default p-4 sm:p-5",
            "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs uppercase tracking-wide font-medium text-text-muted">
              {hasAiData ? "Clicks vs AI Citations" : "Search Clicks"}
            </span>
            <p className="text-[11px] text-text-muted">Trend for the selected range</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent-primary)" }} aria-hidden="true" />
              Search Clicks
            </span>
            {hasAiData ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent-ai)" }} aria-hidden="true" />
                AI Citations
              </span>
            ) : null}
          </div>
        </div>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 320 }}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-ai)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent-ai)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="var(--border-subtle)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "var(--border-default)" }}
              />
              <YAxis
                stroke="var(--border-subtle)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "var(--border-default)" }}
                tickFormatter={(val) => `${val / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-elevated)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  fontSize: "12px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
                }}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                name="Search Clicks"
                stroke="var(--accent-primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#clicksGrad)"
              />
              {hasAiData ? (
                <Area
                  type="monotone"
                  dataKey="aiReferrals"
                  name="AI Citations"
                  stroke="var(--accent-ai)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#aiGrad)"
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        </div>
      </InView>
    </div>
  );
}
