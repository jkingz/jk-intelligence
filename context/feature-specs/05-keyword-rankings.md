# 05 — Keyword Rankings Read/History + Sync Revalidation & Cron Hardening

## Goal
Provide a dedicated read/history path for `keyword_rankings` (table is seeded/persisted by `persist_metrics` but had no API or time-series view), and close the cron quirks: POST-only cron, per-active-client enqueueing, and a wired `dashboard-overview` revalidation after syncs.

**Status: implemented** (52 tests, typecheck, lint, build pass; trend chart browser-verified via throwaway route; keyword read path verified against the live seeded DB).

## Keyword Rankings (Item 10)
- **Shared types** (`types/dashboard.ts`): `RankPoint { date, rank }`, `KeywordRankSeries { keyword, currentRank, points }`.
- **Pure builder** (`lib/dashboard/keywords.ts`): `buildKeywordSeries(rows, now)` groups `keyword_rankings` rows per keyword, discards any keyword whose latest rank is missing (`null` rank rows are skipped), sorts series by current rank (best first), and sorts each series chronologically. First-class `ready()/done()` observability in the pure builder (used by tests).
- **Repository** (`lib/db/repository.ts`): `keywordRankingRowSchema` (`rank` coerced with `z.coerce.number()` — PostgREST can return `numeric` as a string), `listKeywordRankings(clientId, source, from, to)`, `getKeywordRankingHistory(client, days, now)` (2× window, `<= now`), and `getCachedKeywordHistory(client, days)` — `unstable_cache` keyed by client+days, tagged with the shared `DASHBOARD_OVERVIEW_TAG` so sync revalidation refreshes the keyword series too.
- **API route** (`app/api/metrics/[clientId]/keywords/route.ts`): GET, zod-validated `clientId` (a `RouteContext` param, awaited in Next 16) + query (`source` enum default `gsc`, `from`/`to` ISO). `enforceClientAccess` (401 unauthenticated / 403 cross-client). Returns `{ data: KeywordRankSeries[], meta: { source, range } }`.
- **Dashboard view**: `query-table.tsx` gains a `history` prop; each row's Trend cell opens the chart. Buttons are keyboard-reachable; clicking the row itself also toggles. `keyword-rank-chart.tsx` renders a recharts `LineChart` with a reversed Y axis (rank 1 at top of the plot), `ResponsiveContainer initialDimension` (silences the width/height −1 first-measure warning), token colors, and a `#rank` header (current rank + gained/lost delta). `app/page.tsx` fetches the overview and keyword history in parallel; `Dashboard`/`QueryTable` pass `history` through; both the keyword button (chip) and Trend button open the same chart, filtered rows keep working, and search behavior is preserved.
- Scope: `types/dashboard.ts`, `lib/dashboard/keywords.ts`, `lib/db/repository.ts`, `app/api/metrics/[clientId]/keywords/route.ts`, `components/features/dashboard/components/query-table.tsx`, `.components/keyword-rank-chart.tsx, dashboard.tsx`, `app/page.tsx`.

## Cron & Revalidation (Item 9)
- **`lib/auth/cron.ts`**: pure `verifyCronSecret(request, secret)` → `"ok" | "unavailable" | "denied"` (constant-time for non-empty secret).
- **`app/api/cron/sync/route.ts`**: POST-only (removed `export const GET = POST`), secret-checked, iterates `listActiveClients()` and `Promise.allSettled`s a BullMQ enqueue per client (partial failures reported as `{ clientId, message }`, never aborting the run). Run id = today's date so repeated enqueues are idempotent (`persist_metrics` conflicts no-op). Returns `{ queued, errors }` with 202.
- **Revalidation wire-up**: `revalidateTag` throws outside a Next request context (`Invariant: static generation store missing`), so the standalone BullMQ worker cannot call it directly. Instead: `lib/cache/invalidate.ts` owns the shared tag `DASHBOARD_OVERVIEW_TAG = "dashboard-overview"` + `revalidateDashboardOverview()` (`revalidateTag(tag, { expire: 0 })`); `lib/cache/notify.ts` gives the worker a `notifyDashboardRevalidated()` bridge that POSTs to `/api/revalidate/dashboard` with the `CRON_SECRET`, no-oping when `NEXT_PUBLIC_APP_URL`/`VERCEL_URL` or the secret is absent; `lib/queue/worker.ts` awaits it after each processed sync job. The route (`app/api/revalidate/dashboard/route.ts`) is secret-guarded and calls `revalidateDashboardOverview()`, returning `{ revalidated: true, tag }`.
- **`vercel.json`**: cron `POST /api/cron/sync` at `0 2 * * *` (Vercel attaches `Authorization: Bearer <CRON_SECRET>`).
- Queue Redis: `redisConnection()` prefers an explicit `REDIS_URL` and otherwise derives `rediss://default:<UPSTASH_REDIS_REST_TOKEN>@<host>:6379` from `UPSTASH_REDIS_REST_URL` (host extracted) + `UPSTASH_REDIS_REST_TOKEN`; throws a clear error if neither exists. Queue and worker share the same connection.
- Scope: `vercel.json`, `lib/auth/cron.ts`, `lib/cache/invalidate.ts`, `lib/cache/notify.ts`, `lib/queue/syncQueue.ts`, `lib/queue/worker.ts`, `app/api/cron/sync/route.ts`, `app/api/revalidate/dashboard/route.ts`.

## Security
- Revalidation route and cron are guarded by `verifyCronSecret` (same secret Vercel sends; disabled effectively when unset).
- Keyword read shares the existing `enforceClientAccess` path (401/403), matching the repo's RLS-backed ownership model.
- No credentials in logs or responses.

## Verification
1. Unit/integration: 52 tests pass — new `lib/auth/cron.test.ts`, `lib/dashboard/keywords.test.ts`, `lib/queue/syncQueue.test.ts`, `lib/queue/flow.test.ts` (rewritten: mocked BullMQ per-client enqueue, partial-failure survivor, unauthorized, malformed-job), `app/api/metrics/[clientId]/keywords/route.test.ts`, `app/api/revalidate/dashboard/route.test.ts`.
2. `pnpm typecheck`, `pnpm lint`, `pnpm build` pass; build emits `/api/metrics/[clientId]/keywords` and `/api/revalidate/dashboard`; cron is POST-only.
3. Live DB: `getKeywordRankingHistory` returns 20 series per client (dense daily points, best-first ordering) — verified via tsx against the seeded Supabase project.
4. Browser (throwaway route + Playwright): 0 console errors/warnings after `ResponsiveContainer initialDimension`; chart renders heading/legend/dates/rank axis; close + reopen, tooltip on hover, and search-as-you-type all work. Screenshot not visually inspected (no image input) — structure confirmed via accessibility snapshot.