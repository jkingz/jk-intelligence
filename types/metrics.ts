export const SOURCES = ["gsc", "ga4", "semrush"] as const;

export type Source = (typeof SOURCES)[number];

export type NormalizedMetric = {
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  conversions: number | null;
  keyword: string | null;
  rank: number | null;
  searchVolume: number | null;
};

export type CurrentMetrics = {
  client_id: string;
  source: Source;
  metrics: NormalizedMetric[];
  synced_at: string;
  is_stale: boolean;
};

export type Client = {
  id: string;
  name: string;
  domain: string;
  is_active: boolean;
};

export type SyncLogInput = {
  client_id: string;
  source?: Source;
  stage: "queue" | "sync" | "transform" | "cache";
  status: "queued" | "success" | "partial" | "failed" | "skipped";
  message: string;
  job_id?: string;
};

/**
 * The one role list. `users_role_check` (20260920000000_add_staff_role.sql) is what
 * Postgres actually enforces; this is the copy TypeScript agrees with, and
 * `tests/admin/unit/role-set.test.ts` reads the DDL to keep the two from drifting.
 */
export const MEMBER_ROLES = ["admin", "client", "staff"] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];
