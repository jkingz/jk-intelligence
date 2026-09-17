import "server-only";

import { z } from "zod";
import { getAdminDb } from "@/lib/db/admin";
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

async function databaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
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
