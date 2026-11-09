import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  scoped: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.scoped,
}));

vi.mock("@/lib/db/admin", () => ({
  getAdminDb: boundary.admin,
}));

import { getDashboardOverview, getKeywordRankingHistory } from "@/lib/db/repository";
import type { DashboardClient } from "@/types/dashboard";
import { calls, fakeDb, type Result } from "../../helpers/fake-postgrest";

const CLIENT: DashboardClient = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Northstar Studio",
  domain: "northstar.example",
  initials: "NS",
};

const DAY_MS = 86_400_000;

/** Newest snapshot in every fixture, and the two days the anchor should name. */
const LATEST = "2026-10-25T00:00:00+00:00";
const ANCHOR_FROM = new Date(Date.UTC(2026, 9, 11)).toISOString();
const ANCHOR_TO = new Date(Date.UTC(2026, 9, 25)).toISOString();

function gscMetrics(clicks: number) {
  return [
    {
      clicks,
      impressions: clicks * 10,
      ctr: 10,
      position: 3,
      conversions: 1,
      keyword: "alpha",
      rank: 4,
      searchVolume: 1000,
    },
  ];
}

/** 14 daily gsc snapshots, Oct 12–25, so both the current and previous periods are populated. */
function snapshots(): Result {
  const rows = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(Date.UTC(2026, 9, 12) + index * DAY_MS)
      .toISOString()
      .slice(0, 10);
    return {
      source: "gsc",
      metrics: gscMetrics(100 + index),
      synced_at: `${day}T00:00:00+00:00`,
    };
  });
  return { data: rows, error: null };
}

function latest(): Result {
  return { data: { synced_at: LATEST }, error: null };
}

function current(isStale = false): Result {
  return {
    data: {
      client_id: CLIENT.id,
      source: "gsc",
      metrics: gscMetrics(113),
      synced_at: LATEST,
      is_stale: isStale,
    },
    error: null,
  };
}

afterEach(() => {
  boundary.scoped.mockReset();
  boundary.admin.mockReset();
  calls.length = 0;
});

describe("getDashboardOverview window", () => {
  it("renders the newest snapshot even when it aged out of a now-relative window", async () => {
    boundary.admin.mockReturnValue(fakeDb("admin", [latest(), snapshots(), current()]));

    // 15 days after the newest snapshot: under the old now-relative window
    // (to = now, from = now − 14d) this returned null and the dashboard blanked.
    const overview = await getDashboardOverview(CLIENT, 7, new Date("2026-11-09T00:00:00Z"));

    expect(overview).not.toBeNull();
    expect(overview!.lastUpdated).toBe("Oct 25, 2026");
    expect(overview!.traffic).toHaveLength(7);
    expect(overview!.staleSource).toBe(true);
    expect(calls).toContain(`admin.gte(synced_at,${ANCHOR_FROM})`);
    expect(calls).toContain(`admin.lte(synced_at,${ANCHOR_TO})`);
  });

  it("keeps the stored stale flag false for a fresh snapshot", async () => {
    boundary.admin.mockReturnValue(fakeDb("admin", [latest(), snapshots(), current()]));

    const overview = await getDashboardOverview(CLIENT, 7, new Date("2026-10-25T00:00:00Z"));

    expect(overview!.staleSource).toBe(false);
  });

  it("does not read metrics when the client has never synced", async () => {
    boundary.admin.mockReturnValue(fakeDb("admin", [{ data: null, error: null }]));

    await expect(getDashboardOverview(CLIENT, 7, new Date("2026-11-09T00:00:00Z"))).resolves.toBeNull();
    // Only the latest-time probe ran; no window read, no current-metrics read.
    expect(calls.some((call) => call.startsWith("admin.gte("))).toBe(false);
    expect(calls).not.toContain("admin.from(current_metrics)");
  });
});

describe("getKeywordRankingHistory window", () => {
  it("anchors keyword history on the newest snapshot", async () => {
    boundary.admin.mockReturnValue(
      fakeDb("admin", [
        latest(),
        { data: [{ keyword: "alpha", rank: 4, synced_at: LATEST }], error: null },
      ]),
    );

    const series = await getKeywordRankingHistory(CLIENT, 7);

    expect(series).toEqual([
      { keyword: "alpha", currentRank: 4, points: [{ date: "2026-10-25", rank: 4 }] },
    ]);
    expect(calls).toContain(`admin.gte(synced_at,${ANCHOR_FROM})`);
    expect(calls).toContain(`admin.lte(synced_at,${ANCHOR_TO})`);
  });

  it("returns an empty series when the client has never synced", async () => {
    boundary.admin.mockReturnValue(fakeDb("admin", [{ data: null, error: null }]));

    await expect(getKeywordRankingHistory(CLIENT, 7)).resolves.toEqual([]);
    expect(calls.some((call) => call.startsWith("admin.gte("))).toBe(false);
  });
});
