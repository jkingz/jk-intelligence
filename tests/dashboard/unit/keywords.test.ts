import { describe, expect, it } from "vitest";

import type { KeywordRankingRow } from "@/lib/dashboard/keywords";
import { buildKeywordSeries } from "@/lib/dashboard/keywords";

const row = (
  keyword: string,
  rank: number,
  date: string,
): KeywordRankingRow => ({
  keyword,
  rank,
  syncedAt: `${date}T00:00:00.000Z`,
});

describe("buildKeywordSeries", () => {
  it("groups rows by keyword, chronologically ordered", () => {
    const series = buildKeywordSeries([
      row("alpha", 4, "2026-09-15"),
      row("alpha", 3, "2026-09-16"),
      row("bravo", 12, "2026-09-15"),
      row("bravo", 9, "2026-09-16"),
      row("alpha", 2, "2026-09-17"),
    ]);

    expect(series).toEqual([
      {
        keyword: "alpha",
        currentRank: 2,
        points: [
          { date: "2026-09-15", rank: 4 },
          { date: "2026-09-16", rank: 3 },
          { date: "2026-09-17", rank: 2 },
        ],
      },
      {
        keyword: "bravo",
        currentRank: 9,
        points: [
          { date: "2026-09-15", rank: 12 },
          { date: "2026-09-16", rank: 9 },
        ],
      },
    ]);
  });

  it("orders series best-first by current rank and tolerates out-of-order rows", () => {
    const series = buildKeywordSeries([
      row("low", 20, "2026-09-16"),
      row("high", 1, "2026-09-16"),
      row("low", 21, "2026-09-15"),
      row("mid", 7, "2026-09-15"),
    ]);

    expect(series.map((s) => s.keyword)).toEqual(["high", "mid", "low"]);
    expect(series[2].points.map((p) => p.date)).toEqual(["2026-09-15", "2026-09-16"]);
  });

  it("returns an empty array for no rows and skips invalid dates", () => {
    expect(buildKeywordSeries([])).toEqual([]);
    expect(buildKeywordSeries([{ ...row("alpha", 3, "2026-09-15"), syncedAt: "nope" }])).toEqual(
      [],
    );
  });
});