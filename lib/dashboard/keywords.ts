import type { KeywordRankSeries, RankPoint } from "@/types/dashboard";

export interface KeywordRankingRow {
  keyword: string;
  rank: number;
  syncedAt: string;
}

/**
 * Groups raw `keyword_rankings` rows into per-keyword, chronologically ordered
 * rank series. Series are ordered best-first (lowest current rank) so the
 * dashboard's query table and trend chart agree.
 */
export function buildKeywordSeries(rows: KeywordRankingRow[]): KeywordRankSeries[] {
  const byKeyword = new Map<string, RankPoint[]>();

  for (const row of rows) {
    const time = new Date(row.syncedAt).getTime();
    if (Number.isNaN(time)) continue;
    const date = new Date(time).toISOString().slice(0, 10);
    const points = byKeyword.get(row.keyword) ?? [];
    points.push({ date, rank: row.rank });
    byKeyword.set(row.keyword, points);
  }

  return [...byKeyword.entries()]
    .map(([keyword, points]) => {
      points.sort((a, b) => a.date.localeCompare(b.date));
      return {
        keyword,
        currentRank: points[points.length - 1]?.rank ?? 0,
        points,
      };
    })
    .sort((a, b) => a.currentRank - b.currentRank);
}