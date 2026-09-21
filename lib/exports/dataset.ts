import { buildOverview, type MetricSnapshotInput } from "@/lib/dashboard/overview";
import type {
  DashboardClient,
  DashboardRange,
  KeywordRow,
} from "@/types/dashboard";
import type {
  ExportDataset,
  ExportMetricRow,
  ExportSourceTotal,
  ExportSummaryRow,
} from "@/types/exports";
import { SOURCES, type NormalizedMetric } from "@/types/metrics";

const DAY_MS = 86_400_000;

export interface BuildExportDatasetInput {
  client: DashboardClient;
  days: DashboardRange;
  /** All sources, already bounded to the 2× window by the repository. */
  snapshots: MetricSnapshotInput[];
  now: Date;
}

function dayStart(time: number): number {
  return Math.floor(time / DAY_MS) * DAY_MS;
}

function formatDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function formatRangeLabel(from: number, to: number): string {
  const format = (time: number) =>
    new Date(time).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${format(from)} – ${format(to)}, ${new Date(to).getUTCFullYear()}`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function signedPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function signedPosition(value: number): string {
  const direction = value > 0 ? "gained" : value < 0 ? "lost" : "changed";
  return `${Math.abs(value).toFixed(1)} pos ${direction}`;
}

function summaryRows(overview: ReturnType<typeof buildOverview>): ExportSummaryRow[] {
  if (!overview) {
    return [
      { label: "Total clicks", value: "0", delta: null },
      { label: "Impressions", value: "0", delta: null },
      { label: "CTR", value: "0.00%", delta: null },
      { label: "Conversions", value: "0", delta: null },
      { label: "Average position", value: "—", delta: null },
      { label: "Keywords in top 3", value: "0", delta: null },
    ];
  }
  return [
    {
      label: "Total clicks",
      value: overview.clicks.toLocaleString("en-US"),
      delta: signedPercent(overview.growth),
    },
    {
      label: "Impressions",
      value: overview.impressions.toLocaleString("en-US"),
      delta: signedPercent(overview.impressionsGrowth),
    },
    {
      label: "CTR",
      value: `${overview.ctr.toFixed(2)}%`,
      delta: null,
    },
    {
      label: "Conversions",
      value: overview.conversions.toLocaleString("en-US"),
      delta: null,
    },
    {
      label: "Average position",
      value: overview.averagePosition.toFixed(1),
      delta: signedPosition(overview.positionChange),
    },
    {
      label: "Keywords in top 3",
      value: String(overview.topThreeCount),
      delta: `${overview.gainedTopThree} newly entered`,
    },
  ];
}

function toMetricRows(snapshots: MetricSnapshotInput[]): ExportMetricRow[] {
  const rows: ExportMetricRow[] = [];
  for (const snapshot of snapshots) {
    const date = formatDay(new Date(snapshot.syncedAt).getTime());
    for (const metric of snapshot.metrics) {
      rows.push({
        date,
        source: snapshot.source,
        keyword: metric.keyword,
        clicks: metric.clicks,
        impressions: metric.impressions,
        ctr: metric.ctr,
        position: metric.position,
        conversions: metric.conversions,
        rank: metric.rank,
        searchVolume: metric.searchVolume,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.source.localeCompare(b.source) ||
      (a.keyword ?? "").localeCompare(b.keyword ?? ""),
  );
}

function sourceTotals(snapshots: MetricSnapshotInput[]): ExportSourceTotal[] {
  const totals: ExportSourceTotal[] = [];
  for (const source of SOURCES) {
    const metrics: NormalizedMetric[] = snapshots
      .filter((snapshot) => snapshot.source === source)
      .flatMap((snapshot) => snapshot.metrics);
    if (metrics.length === 0) continue;
    const numbers = (key: keyof NormalizedMetric) =>
      metrics
        .map((metric) => metric[key])
        .filter((value): value is number => typeof value === "number");
    const positions = numbers("position");
    totals.push({
      source,
      records: metrics.length,
      clicks: sum(numbers("clicks")),
      impressions: sum(numbers("impressions")),
      conversions: sum(numbers("conversions")),
      averagePosition: positions.length > 0 ? sum(positions) / positions.length : null,
    });
  }
  return totals;
}

/**
 * Newest snapshot day in a set, or null when it is empty. Bucketed with the same
 * `dayStart` `buildOverview` uses so both agree on which day is the last one.
 */
function latestDay(snapshots: MetricSnapshotInput[]): number | null {
  let latest: number | null = null;
  for (const snapshot of snapshots) {
    const time = new Date(snapshot.syncedAt).getTime();
    if (Number.isNaN(time)) continue;
    if (latest === null || time > latest) latest = time;
  }
  return latest === null ? null : dayStart(latest);
}

/**
 * Pure CSV/PDF export payload for one client + range. `buildOverview` is the
 * single source of truth for the summary and keyword table so an export can
 * never disagree with the dashboard. Every section anchors to the newest **GSC**
 * snapshot day — when another source is newer, its rows beyond that day are
 * dropped rather than reported under a GSC-derived range.
 */
export function buildExportDataset({
  client,
  days,
  snapshots,
  now,
}: BuildExportDatasetInput): ExportDataset {
  const gscSnapshots = snapshots.filter((snapshot) => snapshot.source === "gsc");
  const anchor = latestDay(gscSnapshots) ?? latestDay(snapshots) ?? dayStart(now.getTime());
  const endDay = anchor;
  const startDay = endDay - (days - 1) * DAY_MS;
  const inWindow = snapshots.filter((snapshot) => {
    const day = dayStart(new Date(snapshot.syncedAt).getTime());
    return day >= startDay && day <= endDay;
  });

  const overview = buildOverview({
    client,
    days,
    snapshots: gscSnapshots,
    stale: false,
    now,
  });
  const keywords: KeywordRow[] = overview?.keywords ?? [];

  return {
    client,
    days,
    generatedAt: formatDay(now.getTime()),
    range: {
      from: formatDay(startDay),
      to: formatDay(endDay),
      label: formatRangeLabel(startDay, endDay),
    },
    summary: summaryRows(overview),
    keywords,
    sourceTotals: sourceTotals(inWindow),
    metrics: toMetricRows(inWindow),
  };
}