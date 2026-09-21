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
/**
 * Spreadheets trim leading whitespace and ignore control characters before
 * deciding whether a cell is a formula, so the marker test runs on the content
 * after them — `"  =cmd"` is as dangerous as `"=cmd"`.
 */
const LEADING_NOISE = /^[\s\u0000-\u001F\u007F]+/;

function guardFormula(value: string): string {
  const content = value.replace(LEADING_NOISE, "");
  return FORMULA_PREFIXES.some((prefix) => content.startsWith(prefix))
    ? `'${value}`
    : value;
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
 * RFC 4180 CSV for the raw metrics in a dataset. Cells whose content begins
 * with a spreadsheet formula character — ignoring leading whitespace and
 * control characters — are prefixed with `'` so a keyword named `=cmd` cannot
 * execute when the file is opened in Excel/Sheets. A UTF-8 BOM is prepended so
 * Excel detects the encoding.
 */
export function toCsv(dataset: ExportDataset): string {
  const lines = [CSV_HEADERS.join(","), ...dataset.metrics.map(metricRow)];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}