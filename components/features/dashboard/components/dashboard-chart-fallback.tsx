"use client";

// Recharts-free fallback. Kept out of dashboard-chart.tsx (which imports
// recharts) so the chart module can be split behind `dynamic()` — the initial
// parse never includes the chart library or its first-party barrel.
export function DashboardChartFallback() {
  return (
    <div className="relative lg:col-span-2 min-w-0">
      <div className="relative bg-surface rounded-xl border border-default p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs uppercase tracking-wide font-medium text-text-muted">Search Clicks</span>
            <p className="text-[11px] text-text-muted">Trend for the selected range</p>
          </div>
        </div>
        <div className="w-full h-80" />
      </div>
    </div>
  );
}
