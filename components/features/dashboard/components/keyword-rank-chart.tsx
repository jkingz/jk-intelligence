"use client";

import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankPoint } from "@/types/dashboard";

interface KeywordRankChartProps {
  keyword: string;
  rank: number;
  change: number | null;
  points: RankPoint[];
  onClose: () => void;
}

export function KeywordRankChart({
  keyword,
  rank,
  change,
  points,
  onClose,
}: KeywordRankChartProps) {
  const maxRank = Math.max(...points.map((point) => point.rank), rank);

  return (
    <div className="border-b border-border-default p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="font-serif text-base font-medium text-text-primary truncate">{keyword}</h3>
          <p className="text-[11px] text-text-muted mt-0.5">Rank trend for the selected range</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-2 font-mono text-sm text-text-primary">
            <span className="text-[11px] uppercase tracking-wide text-text-muted font-sans">Rank</span>
            #{rank}
          </span>
          {change === null ? (
            <span className="inline-flex items-center text-text-muted font-mono text-xs">— no prior rank</span>
          ) : change > 0 ? (
            <span className="inline-flex items-center text-state-success font-mono text-xs font-medium gap-0.5">
              <ArrowUpRight className="size-3" aria-hidden="true" /> {change} gained
            </span>
          ) : change < 0 ? (
            <span className="inline-flex items-center text-state-error font-mono text-xs font-medium gap-0.5">
              <ArrowDownRight className="size-3" aria-hidden="true" /> {Math.abs(change)} lost
            </span>
          ) : (
            <span className="inline-flex items-center text-text-muted font-mono text-xs">Unchanged</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-secondary/50 transition-colors"
            aria-label={`Close rank trend for ${keyword}`}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 224 }}>
          <LineChart data={points} margin={{ top: 5, right: 10, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="date"
              stroke="var(--border-subtle)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--border-default)" }}
              minTickGap={24}
            />
            <YAxis
              reversed
              domain={[1, maxRank + 1]}
              stroke="var(--border-subtle)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--border-default)" }}
              tickFormatter={(value) => `#${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bg-elevated)",
                borderRadius: "6px",
                border: "1px solid var(--border-default)",
                fontSize: "12px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
              }}
              formatter={(value) => [`#${value}`, "Rank"]}
            />
            <Line
              type="monotone"
              dataKey="rank"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "var(--accent-primary)", stroke: "none" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}