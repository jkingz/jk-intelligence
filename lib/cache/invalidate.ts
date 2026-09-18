import "server-only";

import { revalidateTag } from "next/cache";

export const DASHBOARD_OVERVIEW_TAG = "dashboard-overview";

/**
 * Whole repo reference to the tag used by the dashboard-overview and
 * keyword-history caches. Compute in-process because a demo tag name used from
 * two cached helpers that both write `keyword_rankings`/`metrics_snapshots`
 * data must invalidate together after a sync.
 */
export const DASHBOARD_REVALIDATE_PROFILE = { expire: 0 } as const;

/**
 * Must run inside a Next request (route handler or server function) — the
 * standalone worker cannot call `revalidateTag` directly. `{ expire: 0 }`
 * makes the next dashboard read a blocking cache miss, so the cache never
 * trails a completed sync.
 */
export function revalidateDashboardOverview(): void {
  revalidateTag(DASHBOARD_OVERVIEW_TAG, DASHBOARD_REVALIDATE_PROFILE);
}