import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import { DASHBOARD_OVERVIEW_TAG } from "@/lib/cache/invalidate";
import { getAdminDb } from "@/lib/db/admin";
import {
  buildOverview,
  toDashboardClient,
  type MetricSnapshotInput,
} from "@/lib/dashboard/overview";
import { buildKeywordSeries, type KeywordRankingRow } from "@/lib/dashboard/keywords";
import type {
  DashboardClient,
  DashboardOverview,
  DashboardRange,
  KeywordRankSeries,
} from "@/types/dashboard";
import {
  SOURCES,
  type Client,
  type CurrentMetrics,
  type NormalizedMetric,
  type Source,
  type SyncLogInput,
} from "@/types/metrics";

const sourceSchema = z.enum(SOURCES);
const idSchema = z.uuid();
const timestampSchema = z.iso.datetime({ offset: true });
const metricSchema = z.strictObject({
  clicks: z.number().nonnegative().nullable(),
  impressions: z.number().nonnegative().nullable(),
  ctr: z.number().nonnegative().nullable(),
  position: z.number().nonnegative().nullable(),
  conversions: z.number().nonnegative().nullable(),
  keyword: z.string().nullable(),
  rank: z.number().nonnegative().nullable(),
  searchVolume: z.number().nonnegative().nullable(),
});
const metricsSchema = z.array(metricSchema);
const clientSchema = z.object({
  id: idSchema,
  name: z.string(),
  domain: z.string(),
  is_active: z.boolean(),
});
const currentSchema = z.object({
  client_id: idSchema,
  source: sourceSchema,
  metrics: metricsSchema,
  synced_at: timestampSchema,
  is_stale: z.boolean(),
});

const snapshotSchema = z.object({
  source: sourceSchema,
  metrics: metricsSchema,
  synced_at: timestampSchema,
});

const keywordRankingRowSchema = z.object({
  keyword: z.string().min(1),
  rank: z.coerce.number().nonnegative(),
  synced_at: timestampSchema,
});

async function databaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(
      "[db] operation failed:",
      error instanceof Error ? error.message : error,
    );
    throw new Error("Database operation failed");
  }
}

export async function listActiveClients(): Promise<Client[]> {
  return databaseOperation(async () => {
    const clients: Client[] = [];
    let cursor: string | undefined;
    for (;;) {
      let query = getAdminDb()
        .from("clients")
        .select("id,name,domain,is_active")
        .eq("is_active", true)
        .order("id")
        .limit(500);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error || !data) throw new Error("Database operation failed");
      const page = z.array(clientSchema).parse(data);
      if (page.length === 0) return clients;
      clients.push(...page);
      cursor = page[page.length - 1].id;
    }
  });
}

export async function getActiveClient(id: string): Promise<Client | null> {
  return databaseOperation(async () => {
    const { data, error } = await getAdminDb()
      .from("clients")
      .select("id,name,domain,is_active")
      .eq("id", idSchema.parse(id))
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error("Database operation failed");
    return data ? clientSchema.parse(data) : null;
  });
}

export async function persistMetrics(
  clientId: string,
  source: Source,
  metrics: NormalizedMetric[],
  syncedAt: string,
  runId: string,
): Promise<void> {
  return databaseOperation(async () => {
    const { error } = await getAdminDb().rpc("persist_metrics", {
      p_client_id: idSchema.parse(clientId),
      p_source: sourceSchema.parse(source),
      p_metrics: metricsSchema.parse(metrics),
      p_synced_at: timestampSchema.parse(syncedAt),
      p_run_id: z.string().trim().min(1).max(512).parse(runId),
    });
    if (error) throw new Error("Database operation failed");
  });
}

export async function getCurrentMetrics(
  clientId: string,
  source: Source,
): Promise<CurrentMetrics | null> {
  return databaseOperation(async () => {
    const { data, error } = await getAdminDb()
      .from("current_metrics")
      .select("client_id,source,metrics,synced_at,is_stale")
      .eq("client_id", idSchema.parse(clientId))
      .eq("source", sourceSchema.parse(source))
      .maybeSingle();
    if (error) throw new Error("Database operation failed");
    return data ? currentSchema.parse(data) : null;
  });
}

export async function markMetricsStale(
  clientId: string,
  source: Source,
): Promise<void> {
  return databaseOperation(async () => {
    const { error } = await getAdminDb()
      .from("current_metrics")
      .update({ is_stale: true })
      .eq("client_id", idSchema.parse(clientId))
      .eq("source", sourceSchema.parse(source));
    if (error) throw new Error("Database operation failed");
  });
}

export async function writeSyncLog(input: SyncLogInput): Promise<void> {
  return databaseOperation(async () => {
    const log = z.strictObject({
      client_id: idSchema,
      source: sourceSchema.optional(),
      stage: z.enum(["queue", "sync", "transform", "cache"]),
      status: z.enum(["queued", "success", "partial", "failed", "skipped"]),
      message: z.string().min(1).max(2000),
      job_id: z.string().min(1).max(512).optional(),
    }).parse(input);
    const { error } = await getAdminDb().from("sync_logs").insert(log);
    if (error) throw new Error("Database operation failed");
  });
}

export async function listMetricSnapshots(
  clientId: string,
  source: Source,
  from: string,
  to: string,
): Promise<MetricSnapshotInput[]> {
  return databaseOperation(async () => {
    const { data, error } = await getAdminDb()
      .from("metrics_snapshots")
      .select("source,metrics,synced_at")
      .eq("client_id", idSchema.parse(clientId))
      .eq("source", sourceSchema.parse(source))
      .gte("synced_at", timestampSchema.parse(from))
      .lte("synced_at", timestampSchema.parse(to))
      .order("synced_at", { ascending: true });
    if (error || !data) throw new Error("Database operation failed");
    return z.array(snapshotSchema).parse(data).map((row) => ({
      source: row.source,
      metrics: row.metrics,
      syncedAt: row.synced_at,
    }));
  });
}

/**
 * Dedicated read path for `keyword_rankings`: the per-keyword, per-date rank
 * history persisted by `persist_metrics`. Time-bounded so API callers can page
 * a range and the dashboard can plot a series.
 */
export async function listKeywordRankings(
  clientId: string,
  source: Source,
  from: string,
  to: string,
): Promise<KeywordRankingRow[]> {
  return databaseOperation(async () => {
    const { data, error } = await getAdminDb()
      .from("keyword_rankings")
      .select("keyword,rank,synced_at")
      .eq("client_id", idSchema.parse(clientId))
      .eq("source", sourceSchema.parse(source))
      .gte("synced_at", timestampSchema.parse(from))
      .lte("synced_at", timestampSchema.parse(to))
      .order("synced_at", { ascending: true });
    if (error || !data) throw new Error("Database operation failed");
    return z.array(keywordRankingRowSchema).parse(data).map((row) => ({
      keyword: row.keyword,
      rank: row.rank,
      syncedAt: row.synced_at,
    }));
  });
}

export async function listAccessibleClients(profile: {
  role: "admin" | "client" | null;
  clientId: string | null;
}): Promise<DashboardClient[]> {
  if (profile.role === "admin") {
    return (await listActiveClients()).map(toDashboardClient);
  }
  if (profile.role === "client" && profile.clientId) {
    const client = await getActiveClient(profile.clientId);
    return client ? [toDashboardClient(client)] : [];
  }
  return [];
}

export async function getDashboardOverview(
  client: DashboardClient,
  days: DashboardRange,
  now: Date = new Date(),
): Promise<DashboardOverview | null> {
  const dayMs = 86_400_000;
  const from = new Date(now.getTime() - days * 2 * dayMs).toISOString();
  const to = now.toISOString();
  const snapshots = await listMetricSnapshots(client.id, "gsc", from, to);
  if (snapshots.length === 0) return null;

  const current = await getCurrentMetrics(client.id, "gsc");
  return buildOverview({
    client,
    days,
    snapshots,
    stale: current?.is_stale ?? false,
    now,
  });
}

/**
 * Cross-request cached overview so revisiting a client/range is instant.
 * Keyed by client + range; shared tag with the keyword-history cache so one
 * `revalidateTag` after a sync invalidates both. `unstable_cache` is the
 * pre-`cacheComponents` API (this project does not enable the flag); revisit
 * with `use cache` if enabled.
 */
const cachedDashboardOverview = unstable_cache(
  (client: DashboardClient, days: DashboardRange) => getDashboardOverview(client, days),
  ["dashboard-overview"],
  { revalidate: 300, tags: [DASHBOARD_OVERVIEW_TAG] },
);

export function getCachedDashboardOverview(
  client: DashboardClient,
  days: DashboardRange,
): Promise<DashboardOverview | null> {
  return cachedDashboardOverview(client, days);
}

export async function getKeywordRankingHistory(
  client: DashboardClient,
  days: DashboardRange,
  now: Date = new Date(),
): Promise<KeywordRankSeries[]> {
  const dayMs = 86_400_000;
  const from = new Date(now.getTime() - days * 2 * dayMs).toISOString();
  const to = now.toISOString();
  const rows = await listKeywordRankings(client.id, "gsc", from, to);
  return buildKeywordSeries(rows);
}

const cachedKeywordHistory = unstable_cache(
  (client: DashboardClient, days: DashboardRange) => getKeywordRankingHistory(client, days),
  ["keyword-rankings"],
  { revalidate: 300, tags: [DASHBOARD_OVERVIEW_TAG] },
);

export function getCachedKeywordHistory(
  client: DashboardClient,
  days: DashboardRange,
): Promise<KeywordRankSeries[]> {
  return cachedKeywordHistory(client, days);
}
