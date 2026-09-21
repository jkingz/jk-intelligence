import type { DashboardClient, DashboardRange, KeywordRow } from "@/types/dashboard";
import type { Source } from "@/types/metrics";

export type ExportKind = "metrics" | "report";

export interface ExportMetricRow {
  date: string;
  source: Source;
  keyword: string | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  conversions: number | null;
  rank: number | null;
  searchVolume: number | null;
}

export interface ExportSummaryRow {
  label: string;
  value: string;
  delta: string | null;
}

export interface ExportSourceTotal {
  source: Source;
  records: number;
  clicks: number;
  impressions: number;
  conversions: number;
  averagePosition: number | null;
}

export interface ExportRange {
  from: string;
  to: string;
  label: string;
}

export interface ExportDataset {
  client: DashboardClient;
  days: DashboardRange;
  generatedAt: string;
  range: ExportRange;
  summary: ExportSummaryRow[];
  keywords: KeywordRow[];
  sourceTotals: ExportSourceTotal[];
  metrics: ExportMetricRow[];
}