import type {
  BriefItem,
  DashboardClient,
  DashboardOverview,
  DashboardRange,
  KeywordRow,
  TrafficPoint,
} from "@/types/dashboard";
import type { Client, NormalizedMetric, Source } from "@/types/metrics";

const DAY_MS = 86_400_000;

export interface MetricSnapshotInput {
  source: Source;
  metrics: NormalizedMetric[];
  syncedAt: string;
}

export interface BuildOverviewInput {
  client: DashboardClient;
  days: DashboardRange;
  snapshots: MetricSnapshotInput[];
  stale: boolean;
  now: Date;
}

interface DayBucket {
  time: number;
  clicks: number;
  impressions: number;
  conversions: number;
  metrics: NormalizedMetric[];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

export function toDashboardClient(client: Pick<Client, "id" | "name" | "domain">): DashboardClient {
  return {
    id: client.id,
    name: client.name,
    domain: client.domain,
    initials: initialsOf(client.name),
  };
}

function formatDay(time: number): string {
  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatFullDate(time: number): string {
  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return (current / previous - 1) * 100;
}

function dayStart(time: number): number {
  return Math.floor(time / DAY_MS) * DAY_MS;
}

function aggregateDay(metrics: NormalizedMetric[]): Omit<DayBucket, "time" | "metrics"> {
  const keywordRows = metrics.filter((metric) => metric.keyword !== null);
  const rows = keywordRows.length > 0 ? keywordRows : metrics;
  return {
    clicks: sum(rows.map((metric) => metric.clicks ?? 0)),
    impressions: sum(rows.map((metric) => metric.impressions ?? 0)),
    conversions: sum(rows.map((metric) => metric.conversions ?? 0)),
  };
}

function buildBuckets(snapshots: MetricSnapshotInput[]): DayBucket[] {
  const byDay = new Map<number, DayBucket>();
  for (const snapshot of snapshots) {
    const time = dayStart(new Date(snapshot.syncedAt).getTime());
    if (Number.isNaN(time)) continue;
    const totals = aggregateDay(snapshot.metrics);
    byDay.set(time, { time, metrics: snapshot.metrics, ...totals });
  }
  return [...byDay.values()].sort((a, b) => a.time - b.time);
}

function buildKeywordRows(current: DayBucket[], baseline: DayBucket[]): KeywordRow[] {
  const latest = current[current.length - 1];
  const baselineRanks = new Map<string, number>();
  for (const bucket of baseline) {
    for (const metric of bucket.metrics) {
      if (metric.keyword !== null && metric.rank !== null && !baselineRanks.has(metric.keyword)) {
        baselineRanks.set(metric.keyword, metric.rank);
      }
    }
  }

  return latest.metrics
    .filter((metric): metric is NormalizedMetric & { keyword: string; rank: number } =>
      metric.keyword !== null && metric.rank !== null
    )
    .map((metric) => {
      const baselineRank = baselineRanks.get(metric.keyword);
      return {
        keyword: metric.keyword,
        rank: metric.rank,
        change: baselineRank === undefined ? null : baselineRank - metric.rank,
        volume: metric.searchVolume,
        clicks: metric.clicks ?? 0,
      };
    });
}

function buildBrief(keywords: KeywordRow[], topThreeCount: number): BriefItem[] {
  const ranked = keywords.filter((keyword) => keyword.change !== null);
  const leading = ranked.reduce<KeywordRow | null>(
    (best, keyword) => (best === null || (keyword.change ?? 0) > (best.change ?? 0) ? keyword : best),
    null,
  );
  const declining = ranked.find((keyword) => (keyword.change ?? 0) < 0);

  const brief: BriefItem[] = [];
  if (leading && (leading.change ?? 0) > 0) {
    brief.push({
      title: "Keyword momentum",
      impact: "High Impact",
      description: `${leading.keyword} gained ${leading.change} positions to rank #${leading.rank}. ${topThreeCount} tracked keywords now rank in the top 3.`,
    });
  }
  brief.push({
    title: "Recommended focus",
    impact: "Actionable",
    description: declining
      ? `Review content targeting ${declining.keyword}: down ${Math.abs(declining.change ?? 0)} positions to #${declining.rank}.`
      : "Maintain content quality across your highest-ranking keywords.",
  });
  return brief;
}

export function buildOverview({
  client,
  days,
  snapshots,
  stale,
}: BuildOverviewInput): DashboardOverview | null {
  const source: Source = "gsc";
  const buckets = buildBuckets(snapshots.filter((snapshot) => snapshot.source === source));
  if (buckets.length === 0) return null;

  const endTime = buckets[buckets.length - 1].time;
  const startTime = endTime - (days - 1) * DAY_MS;
  const previousStartTime = startTime - days * DAY_MS;

  const current = buckets.filter((bucket) => bucket.time >= startTime && bucket.time <= endTime);
  const previous = buckets.filter(
    (bucket) => bucket.time >= previousStartTime && bucket.time < startTime,
  );
  const previousByDay = new Map(previous.map((bucket) => [bucket.time, bucket]));

  const traffic: TrafficPoint[] = current.map((bucket) => {
    const prior = previousByDay.get(bucket.time - days * DAY_MS);
    return {
      date: formatDay(bucket.time),
      clicks: bucket.clicks,
      previous: prior?.clicks ?? 0,
      impressions: bucket.impressions,
      conversions: bucket.conversions,
      aiReferrals: 0,
      previousAiReferrals: 0,
      previousImpressions: prior?.impressions ?? 0,
    };
  });

  const clicks = sum(traffic.map((point) => point.clicks));
  const previousClicks = sum(traffic.map((point) => point.previous));
  const impressions = sum(traffic.map((point) => point.impressions));
  const previousImpressions = sum(traffic.map((point) => point.previousImpressions));
  const conversions = sum(traffic.map((point) => point.conversions));
  const baseline = current.length > 0 ? [current[0]] : current;

  const keywords = buildKeywordRows(current, baseline);
  const averagePosition =
    keywords.length > 0 ? sum(keywords.map((keyword) => keyword.rank)) / keywords.length : 0;
  const changes = keywords
    .map((keyword) => keyword.change)
    .filter((change): change is number => change !== null);
  const positionChange = changes.length > 0 ? sum(changes) / changes.length : 0;
  const topThreeCount = keywords.filter((keyword) => keyword.rank <= 3).length;
  const gainedTopThree = keywords.filter(
    (keyword) => keyword.rank <= 3 && keyword.change !== null && keyword.rank + keyword.change > 3,
  ).length;

  const firstLabel = traffic[0]?.date ?? formatDay(startTime);
  const lastLabel = traffic[traffic.length - 1]?.date ?? formatDay(endTime);

  return {
    client,
    days,
    source,
    clicks,
    previous: previousClicks,
    impressions,
    previousImpressions,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    growth: ratio(clicks, previousClicks),
    impressionsGrowth: ratio(impressions, previousImpressions),
    averagePosition,
    positionChange,
    topThreeCount,
    gainedTopThree,
    aiReferrals: 0,
    previousAiReferrals: 0,
    aiGrowth: null,
    aiCitations: [],
    brief: buildBrief(keywords, topThreeCount),
    traffic,
    keywords,
    lastUpdated: formatFullDate(endTime),
    dateRange: `${firstLabel} – ${lastLabel}, ${new Date(endTime).getUTCFullYear()}`,
    staleSource: stale,
    syncStatus: stale ? "Cached data — last sync failed" : "GSC, GA4 and Semrush synced",
    freshness: stale ? "Stale snapshot" : "Current snapshot",
  };
}
