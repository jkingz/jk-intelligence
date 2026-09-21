# 06 — Data Export (CSV + PDF)

## Goal
Let an authenticated user download the current client's performance data as CSV (raw metrics) or PDF (branded report) for the selected date range. Closes implementation-order step 14.

## Scope
- CSV export of historical metrics for the selected window (`metrics_snapshots` rows for the client, all sources).
- PDF report per client per date range: summary metrics, keyword table, top queries.
- Both exports respect the exact access model used by the dashboard reads (`listAccessibleClients` scoping + admin bypass), and the requested `?days=` window.

## Out of Scope
- Async/queued export jobs (exports are small, bounded reads — run inline in the handler).
- Emailed exports, scheduled reports, white-label branding.
- Exporting AI citation data (no source exists yet).
- `metrics_snapshots` date-range *custom* picker: exports use the same `7 | 30 | 90` ranges as the dashboard (`DashboardRange`).

## API
Two GET handlers under `app/api/exports/[clientId]/`:

- `GET /api/exports/[clientId]/csv?days=30`
  - `200 text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<client>-metrics-<days>d-<YYYY-MM-DD>.csv"`.
  - Columns: `date, source, keyword, clicks, impressions, ctr, position, conversions, rank, search_volume`.
  - One row per `NormalizedMetric` per snapshot day, all sources. UTF-8 BOM prefix so Excel opens unicode correctly. Formula-injection guard prefixes `'` on cells starting with `= + - @`.
- `GET /api/exports/[clientId]/pdf?days=30`
  - `200 application/pdf`, `Content-Disposition: attachment; filename="<client>-report-<days>d-<YYYY-MM-DD>.pdf"`.
  - Sections: header (client name + domain, range, generated date), summary metrics (clicks, impressions, CTR, conversions, avg position, top-3 count + growth deltas), top keywords table (rank, change, volume, clicks), and a per-source totals table.
  - Built with `pdf-lib` (pure JS, Node runtime, no native deps, no headless browser).
- Both: `400` invalid client id / invalid `days`, `401` unauthenticated, `403` client not in the caller's accessible set, `503` on read failure. `Cache-Control: no-store`.

## Implementation
- `lib/exports/dataset.ts` — pure `buildExportDataset({ client, days, snapshots, keywordRows, now })` → `ExportDataset` with `summary`, `keywordRows`, `sourceTotals`, `range`. Reuses `lib/dashboard/overview.ts` (`buildOverview`) for summary/growth so the export and the dashboard never disagree.
- `lib/exports/csv.ts` — pure `toCsv(dataset)` (RFC 4180 quoting) + `CSV_HEADERS`.
- `lib/exports/pdf.ts` — `renderPdfReport(dataset)` using `pdf-lib` standard fonts; token-independent (PDF has its own fixed print palette).
- `lib/exports/filename.ts` — pure `exportFilename(clientName, days, kind, now)` slugging the client name and stamping the UTC date.
- `lib/db/repository.ts` — reuses `listMetricSnapshots`; adds `listAllMetricSnapshots(clientId, from, to)` (all sources, for CSV) on the existing admin-path read functions.
- Feature UI: `components/features/data-export/` — barrel exports `ExportMenu`; menu lives in the dashboard header (next to Trigger Sync) and downloads via a hidden anchor (`URL.createObjectURL` → `<a download>` revoke), with the standard toast lifecycle + `SlidingWindowLimiter`.
- Wiring: `DashboardHeader` gains an `exportMenu?: React.ReactNode` slot; `app/dashboard/dashboard-view.tsx` renders `<ExportMenu client={...} days={...} />` through the feature barrel. No cross-feature imports.

## Security
- Auth + ownership enforced before any read via `listAccessibleClients({ role, clientId })`; admin sees any client, client/staff only their own — identical to `/api/metrics/[clientId]/overview`.
- Service-role reads stay server-side; never returned to the client.
- No credentials in responses or logs.
- CSV formula injection neutralized; filenames slugged from client name (no path traversal).

## Verification
1. Unit: `pnpm test` — new tests for dataset builder, CSV escaping/injection guard, filename slugging, PDF buffer signature (`%PDF-`), and both route handlers (401/403/400/200, correct content types + filenames).
2. `pnpm typecheck`, `pnpm lint`, `pnpm build`; build emits both export routes.
3. Live DB (seeded so far): hit both routes with the demo admin session and confirm a non-empty CSV (header + N rows) and a valid PDF (opens / `pdftotext` extracts the summary).
4. Browser via the dashboard header: menu opens, both items download with correct filenames, 0 console errors.