import { describe, expect, it } from "vitest";

import type { NormalizedMetric } from "@/types/metrics";
import { buildOverview, initialsOf, toDashboardClient, type MetricSnapshotInput } from "./overview";

function metric(overrides: Partial<NormalizedMetric>): NormalizedMetric {
  return {
    clicks: null,
    impressions: null,
    ctr: null,
    position: null,
    conversions: null,
    keyword: null,
    rank: null,
    searchVolume: null,
    ...overrides,
  };
}

function snapshot(day: string, metrics: NormalizedMetric[], source: "gsc" | "ga4" = "gsc"): MetricSnapshotInput {
  return { source, metrics, syncedAt: `${day}T00:00:00.000Z` };
}

const client = toDashboardClient({ id: "c1", name: "Northstar Studio", domain: "northstar.example" });

function daily(day: string, index: number) {
  return snapshot(day, [
    metric({
      clicks: 100 + index,
      impressions: (100 + index) * 10,
      conversions: 1,
      keyword: "alpha",
      rank: 14 - index,
      searchVolume: 1000,
    }),
  ]);
}

const DAYS = Array.from({ length: 14 }, (_, index) => {
  const time = Date.UTC(2026, 8, 4) + index * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
});

describe("buildOverview", () => {
  it("returns null without gsc snapshots", () => {
    const result = buildOverview({
      client,
      days: 7,
      snapshots: [snapshot("2026-09-17", [metric({ clicks: 5 })], "ga4")],
      stale: false,
      now: new Date("2026-09-18T00:00:00.000Z"),
    });
    expect(result).toBeNull();
  });

  it("builds traffic, previous-period comparison and growth", () => {
    const result = buildOverview({
      client,
      days: 7,
      snapshots: DAYS.map(daily),
      stale: false,
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result).not.toBeNull();
    expect(result!.traffic).toHaveLength(7);
    expect(result!.traffic[0]).toMatchObject({ date: "Sep 11", clicks: 107, previous: 100 });
    expect(result!.traffic[6]).toMatchObject({ date: "Sep 17", clicks: 113, previous: 106 });
    expect(result!.clicks).toBe(770);
    expect(result!.previous).toBe(721);
    expect(result!.growth).toBeCloseTo(6.796, 2);
    expect(result!.impressions).toBe(7700);
    expect(result!.ctr).toBeCloseTo(10, 5);
    expect(result!.dateRange).toBe("Sep 11 – Sep 17, 2026");
    expect(result!.lastUpdated).toBe("Sep 17, 2026");
  });

  it("derives keyword ranks, change, volume and top-three counts", () => {
    const result = buildOverview({
      client,
      days: 7,
      snapshots: DAYS.map(daily),
      stale: false,
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result!.keywords).toEqual([
      { keyword: "alpha", rank: 1, change: 6, volume: 1000, clicks: 113 },
    ]);
    expect(result!.averagePosition).toBe(1);
    expect(result!.positionChange).toBe(6);
    expect(result!.topThreeCount).toBe(1);
    expect(result!.gainedTopThree).toBe(1);
    expect(result!.brief).toHaveLength(2);
    expect(result!.brief[0].description).toContain("alpha gained 6 positions");
  });

  it("has no AI citation data until a source exists", () => {
    const result = buildOverview({
      client,
      days: 7,
      snapshots: DAYS.map(daily),
      stale: true,
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result!.aiCitations).toEqual([]);
    expect(result!.aiReferrals).toBe(0);
    expect(result!.aiGrowth).toBeNull();
    expect(result!.staleSource).toBe(true);
    expect(result!.syncStatus).toBe("Cached data — last sync failed");
  });
});

describe("initialsOf", () => {
  it("uses first and last word initials", () => {
    expect(initialsOf("Northstar Studio")).toBe("NS");
    expect(initialsOf("Atlas")).toBe("AT");
    expect(initialsOf("  ")).toBe("?");
  });
});
