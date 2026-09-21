import type { ExportKind } from "@/types/exports";

function slug(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned || "client";
}

function stamp(now: Date): string {
  return new Date(now.getTime()).toISOString().slice(0, 10);
}

function suffix(kind: ExportKind): string {
  return kind === "report" ? "report" : "metrics";
}

function extension(kind: ExportKind): string {
  return kind === "report" ? "pdf" : "csv";
}

/**
 * `<client-slug>-<kind>-<days>d-<YYYY-MM-DD>.<ext>` — deterministic, path-safe
 * (no separators survive slugging), safe as an HTTP header value.
 */
export function exportFilename(
  clientName: string,
  days: number,
  kind: ExportKind,
  now: Date = new Date(),
): string {
  return `${slug(clientName)}-${suffix(kind)}-${days}d-${stamp(now)}.${extension(kind)}`;
}