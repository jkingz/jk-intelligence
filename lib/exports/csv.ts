import type { ExportDataset, ExportMetricRow } from "@/types/exports";

export const CSV_HEADERS = [
  "date",
  "source",
  "keyword",
  "clicks",
  "impressions",
  "ctr",
  "position",
  "conversions",
  "rank",
  "search_volume",
] as const;

const FORMULA_PREFIXES = ["=", "+", "-", "@"];
const BOM = "\uFEFF";

function guardFormula(value: string): string {
  return FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix)) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  const guarded = guardFormula(value);
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replaceAll('"', '""')}"`;
  }
  return guarded;
}

function cell(value: string | number | null): string {
  if (value === null) return "";
  return typeof value === "number" ? String(value) : escapeCell(value);
}

function row(values: Array<string | number | null>): string {
  return values.map(cell).join(",");
}

function metricRow(metric: ExportMetricRow): string {
  return row([
    metric.date,
    metric.source,
    metric.keyword,
    metric.clicks,
    metric.impressions,
    metric.ctr,
    metric.position,
    metric.conversions,
    metric.rank,
    metric.searchVolume,
  ]);
}

/**
 * RFC 4180 CSV for the raw metrics in a dataset. Cells that begin with a
 * spreadsheet formula character are prefixed with `'` so a keyword named
 * `=cmd` cannot execute when the file is opened in Excel/Sheets. A UTF-8 BOM
 * is prepended so Excel detects the encoding.
 */
export function toCsv(dataset: ExportDataset): string {
  const lines = [CSV_HEADERS.join(","), ...dataset.metrics.map(metricRow)];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}