import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import { DASHBOARD_OVERVIEW_TAG } from "@/lib/cache/invalidate";
import { getAdminDb } from "@/lib/db/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

type ScopedDb = Awaited<ReturnType<typeof getAdminDb>>;

/** Cursor-paged `clients` read. Which rows come back is the caller's concern. */
async function selectActiveClients(db: ScopedDb): Promise<Client[]> {
  const clients: Client[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = db
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
}

/**
 * Cron only — it has no session to scope by, so the queue must see every
 * active client. User-facing reads must use `listAccessibleClients`.
 */
export async function listActiveClients(): Promise<Client[]> {
  return databaseOperation(() => selectActiveClients(getAdminDb()));
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

/** Same as `listMetricSnapshots` without the source filter — CSV/PDF exports need every source. */
export async function listAllMetricSnapshots(
  clientId: string,
  from: string,
  to: string,
): Promise<MetricSnapshotInput[]> {
  return databaseOperation(async () => {
    const { data, error } = await getAdminDb()
      .from("metrics_snapshots")
      .select("source,metrics,synced_at")
      .eq("client_id", idSchema.parse(clientId))
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

/**
 * Newest `synced_at` for one client + source, or null when never synced. Lets a
 * reader anchor its window to the data rather than to wall-clock time, which a
 * stale sync would otherwise silently cut off.
 */
export async function getLatestSnapshotTime(
  clientId: string,
  source: Source,
): Promise<string | null> {
  return databaseOperation(async () => {
    const { data, error } = await getAdminDb()
      .from("metrics_snapshots")
      .select("synced_at")
      .eq("client_id", idSchema.parse(clientId))
      .eq("source", sourceSchema.parse(source))
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Database operation failed");
    return data ? timestampSchema.parse(data.synced_at) : null;
  });
}

/**
 * The tenant gate for a request. Reads as the signed-in user, so Postgres RLS
 * (`clients_select_authenticated`) decides visibility: admins see every active
 * client, client/staff users see only their own. Re-deriving that rule here in
 * TypeScript meant a bug in this function silently widened access while the
 * database stayed correct, and nothing downstream would notice.
 */
export async function listAccessibleClients(): Promise<DashboardClient[]> {
  return (
    await databaseOperation(async () =>
      selectActiveClients(await createServerSupabaseClient()),
    )
  ).map(toDashboardClient);
}

/**
 * Single-client probe for routes that only need allow/deny — same RLS path as
 * `listAccessibleClients`, one row instead of the whole list.
 */
export async function canAccessClient(clientId: string): Promise<boolean> {
  return databaseOperation(async () => {
    const db = await createServerSupabaseClient();
    const { data, error } = await db
      .from("clients")
      .select("id")
      .eq("id", idSchema.parse(clientId))
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error("Database operation failed");
    return data !== null;
  });
}

export async function getDashboardOverview(
  client: DashboardClient,
  days: DashboardRange,
  now: Date = new Date(),
): Promise<DashboardOverview | null> {
  const dayMs = 86_400_000;
  const from = new Date(now.getTime() - days * 2 * dayMs).toISOString();
  const to = now.toISOString();
  const [snapshots, current] = await Promise.all([
    listMetricSnapshots(client.id, "gsc", from, to),
    getCurrentMetrics(client.id, "gsc"),
  ]);
  if (snapshots.length === 0) return null;

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
