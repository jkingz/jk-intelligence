import {
  DEFAULT_DASHBOARD_TAB,
  isDashboardTab,
  type DashboardTab,
} from "@/types/dashboard";

export interface DashboardParamUpdates {
  client?: string;
  days?: number;
  tab?: DashboardTab;
}

/** Reads `?tab=` from a search string, falling back to the default panel. */
export function readDashboardTab(search: string): DashboardTab {
  const tab = new URLSearchParams(search).get("tab");
  return isDashboardTab(tab) ? tab : DEFAULT_DASHBOARD_TAB;
}

/**
 * Merges updates into an existing search string so no write site can drop the
 * params it did not touch — the URL is shared by client, range and tab.
 */
export function withDashboardParams(
  search: string,
  updates: DashboardParamUpdates,
): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
