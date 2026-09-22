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
  - One row per `NormalizedMetric` per snapshot day, all sources, restricted to the window below. UTF-8 BOM prefix so Excel opens unicode correctly. Formula-injection guard prefixes `'` on cells whose content starts with `= + - @` — after skipping leading whitespace and control characters, which spreadsheet apps trim before formula detection.
- `GET /api/exports/[clientId]/pdf?days=30`
  - `200 application/pdf`, `Content-Disposition: attachment; filename="<client>-report-<days>d-<YYYY-MM-DD>.pdf"`.
  - Sections: header (client name + domain, range, generated date), summary metrics (clicks, impressions, CTR, conversions, avg position, top-3 count + growth deltas), top keywords table (rank, change, volume, clicks), and a per-source totals table.
  - Built with `pdf-lib` (pure JS, Node runtime, no native deps, no headless browser) and embedded **Unicode** fonts (see Implementation) so client names, domains and keywords in any script survive.
- Window: every section anchors on the newest **GSC** snapshot day — the same anchor `buildOverview` uses — so range, raw rows, source totals and summary always describe one period. Rows from other sources that are newer than that day are dropped rather than reported under a GSC-derived range; with no GSC data the newest snapshot of any source anchors the window.
- Both: `400` invalid client id / invalid `days`, `401` unauthenticated, `403` client not in the caller's accessible set, `429` per-user export limit (with `Retry-After`), `503` on read or render failure. `Cache-Control: no-store`.

## Implementation
- `lib/exports/dataset.ts` — pure `buildExportDataset({ client, days, snapshots, now })` → `ExportDataset` with `summary`, `keywords`, `sourceTotals`, `range`, `metrics`. Reuses `lib/dashboard/overview.ts` (`buildOverview`) for summary/growth so the export and the dashboard never disagree.
- `lib/exports/csv.ts` — pure `toCsv(dataset)` (RFC 4180 quoting) + `CSV_HEADERS`.
- `lib/exports/pdf.ts` — `renderPdfReport(dataset)` using `pdf-lib` + `@pdf-lib/fontkit`, embedding the vendored `lib/exports/fonts/NotoSans-{Regular,Bold}.ttf` (subset on) instead of the WinAnsi standard-14 fonts; `reportText` only replaces control characters. Token-independent (PDF has its own fixed print palette).
- `lib/exports/filename.ts` — pure `exportFilename(clientName, days, kind, now)` slugging the client name and stamping the UTC date.
- `lib/exports/quota.ts` — `consumeExportQuota(userId)`: 6 exports per 60s per user, counted in Upstash Redis (`INCR` + one-time `EXPIRE`, so sustained traffic cannot slide the window) so the limit holds across serverless instances; falls back to a per-instance `SlidingWindowLimiter` when Redis is unconfigured or unreachable.
- `lib/exports/server.ts` — `loadExportDataset(request, clientId)`: validation → auth → ownership → quota → read → dataset, shared by both routes. The read window is anchored on `getLatestSnapshotTime(clientId, "gsc")` and reaches back `2 × days + 1`, so a sync that is days behind still returns the prior-period rows the comparison needs.
- `lib/db/repository.ts` — reuses `listMetricSnapshots`; adds `listAllMetricSnapshots(clientId, from, to)` (all sources, for CSV) and `getLatestSnapshotTime(clientId, source)` on the existing admin-path read functions.
- `next.config.ts` — `outputFileTracingIncludes` ships `lib/exports/fonts/*.ttf` with the export routes (the fonts are read from disk, which trace analysis cannot see).
- Feature UI: `components/features/data-export/` — barrel exports `ExportMenu`; menu lives in the dashboard header (next to Trigger Sync) and downloads via a hidden anchor (`URL.createObjectURL` → `<a download>` revoke), with the standard toast lifecycle + `SlidingWindowLimiter` (a courtesy guard; the enforced limit is the server-side quota).
- Wiring: `DashboardHeader` gains an `exportMenu?: React.ReactNode` slot; `app/dashboard/dashboard-view.tsx` renders `<ExportMenu client={...} days={...} />` through the feature barrel. No cross-feature imports.

## Security
- Auth + ownership enforced before any read via `getAuthUser()` then `listAccessibleClients()` (RLS-scoped); admin sees any client, client/staff only their own — identical to `/api/metrics/[clientId]/overview`.
- Rate limit enforced at the API boundary (`lib/exports/quota.ts`), not only in the browser component: a direct request cannot bypass it, and each request performs at most one bounded read.
- Service-role reads stay server-side; never returned to the client.
- No credentials in responses or logs.
- CSV formula injection neutralized (including markers hidden behind leading whitespace/control characters); filenames slugged from client name (no path traversal); PDF text drops control characters only.

## Verification
1. Unit: `pnpm test` — tests for dataset builder (window/summary parity, GSC anchor, no-GSC fallback), CSV escaping/injection guard (incl. padded markers), filename slugging, `reportText` unicode preservation, PDF buffer signature (`%PDF-`) for latin and non-latin clients, quota (shared counter, per-user keys, Redis-down and no-Redis fallback), and both route handlers (400/401/403/429/503/200, content types, filenames, anchored read window).
2. `pnpm typecheck`, `pnpm lint`, `pnpm build`; build emits both export routes.
3. Live DB (seeded so far): hit both routes with the demo admin session and confirm a non-empty CSV (header + N rows, window matching the dashboard) and a valid PDF; confirm the 7th request in a minute returns 429 with `Retry-After`.
4. Browser via the dashboard header: menu opens, both items download with correct filenames, 0 console errors.