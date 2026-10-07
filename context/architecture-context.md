# Architecture Context

## Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Framework | Next.js 16 + TypeScript | Full-stack app, server/client boundaries |
| UI | Tailwind 4 + shadcn/ui | Component composition and styling |
| Auth | Supabase Auth + Google OAuth | Identity, sessions, route protection |
| Database | Supabase Postgres | Clients, metrics, credentials, sync logs |
| Database client | `@supabase/supabase-js` | Server-side DB access with JWT tokens |
| Background tasks | BullMQ + Upstash Redis | **Partly built:** queue + worker process exist; the worker performs no sync (returns `mock_completed`) and has no production host |
| Cache | Upstash Redis + Next `unstable_cache` | Data-cache tag `dashboard-overview`; the planned stale-flag TTL lives only in the target design |
| AI Insights | Claude API | **Not built** — see `docs/target-state.md` |
| Deployment | Vercel | App hosting, cron trigger, env management. CI: `.github/workflows/ci.yml` |

## System Boundaries

- `app/api` — route handlers: auth check, input validation, ownership gate, read/delegate.
- `lib/agents` — `authAgent` only (identity + role). sync/transform/cache/insights agents are unbuilt spec.
- `lib/auth` — `cron.ts` (timing-safe bearer check for cron/revalidate) and `routing.ts` (the `proxy.ts` decision table for `/dashboard` + `/connections` + `/profile` + `/admin`, and open-redirect-safe `next`). Both tested.
- `lib/navigation` — `destinations.ts`: the rail's `APP_DESTINATIONS` list and `activeDestination()`. Icons are string keys so the module stays importable from a node-tier test; the key → Lucide mapping lives with the rail component. Every href it lists is in `PROTECTED_PREFIXES`, asserted by `tests/platform/unit/destinations.test.ts`.
- `lib/queue` — BullMQ queue definition (`seo-sync`) + worker entrypoint. Retry policy and circuit breaker are target-state, not code.
- `lib/cache` — `invalidate.ts` owns the dashboard tag; `notify.ts` lets the worker ask the app to revalidate.
- `lib/supabase` — client construction (per-request user client + service-role client).
- `lib/db` — persistence + the RLS-backed tenant gate. `admin.ts` isolates the service-role client.
- `lib/connections` — `status.ts`: `buildConnectionStates()`, the pure join of RLS-visible clients to
  RLS-visible `api_credentials` rows. It derives no ownership; an `clientId` outside the client list
  contributes nothing.
- `lib/dashboard` — read-model assembly (`overview.ts`, `keywords.ts`) shared by the boot and metrics routes, so both return identical shapes.
- `lib/admin` — the provisioning slice, and no React. `schemas.ts` (zod bodies), `errors.ts` (the only
  source of admin error copy: Postgres code → status + sentence), `rpc.ts` (`callAdminRpc`, which keeps
  `error.code` — the reason admin writes do not run through `databaseOperation()`), `http.ts` (the shared
  response shape), `provisioning.ts` (`getAdminView()`: two RLS-backed selects plus the `admin_directory`
  RPC, joined in TypeScript). It never touches `getAdminDb()`.
- `lib/exports` — server-side CSV/PDF assembly, dataset builder, `quota.ts` (per-user export budget), `fonts/` for PDF unicode.
- `lib/rate-limit.ts` — `SlidingWindowLimiter`; throttles auth actions client-side and backs the export quota server-side.
- `components` — `components/ui/*` (shadcn, protected) + `components/features/*` (the `app-shell`
  rail, dashboard widgets, metric cards, stale banners, auth forms, export menu, connection status
  rows, and `admin/` — the provisioning panel, its two tables and two dialogs).
- `types` — `database.ts` is handwritten; generated types are an open item.
- `supabase/migrations` — `20260917000000_seo_poc.sql`, `20260920000000_add_staff_role.sql`,
  `20260920000001_rls_hardening.sql`, `20260925000000_connections_read.sql`,
  `20261005000000_admin_provisioning.sql` (five `public` `security definer` functions; applied to the
  local stack, **not** to the hosted project).

## Storage Model

- **Supabase Postgres**: clients, api_credentials, metrics_snapshots, keyword_rankings, current_metrics, sync_logs, users.
- **No external blob storage**: all metric data stored directly in Postgres (no large artifacts).
- Metric values are **not** typed columns. Each sync run writes a non-empty JSONB array to `metrics_snapshots.metrics`; `current_metrics` holds a copy pointing at that snapshot. Only `keyword_rankings` is stored as typed columns.
- Immutable snapshots (metrics_snapshots) — never overwrite, always append. Uniqueness `(client_id, source, run_id)` makes a re-run idempotent.
- Denormalized cache (current_metrics) — one row per `(client_id, source)`, primary read path for the dashboard.
- Dashboard reads cached in the Next data cache via `unstable_cache` (tag `dashboard-overview`), invalidated after syncs through the revalidation route above.

### Persistence Schema

Verified against `supabase/migrations/*` — not from the original spec.

- `clients`: id uuid PK, name, **domain** (unique on `lower(domain)`), is_active, created_at.
- `users`: id uuid PK → `auth.users` on delete cascade, role (`admin`|`client`|`staff`, default `client`), client_id FK (on delete set null), created_at. **No email column** — email lives in `auth.users`. Constraint `users_admin_has_no_tenant`: `admin` must have `client_id is null`.
- `api_credentials`: client_id FK, source (`gsc`|`ga4`|`semrush`), credential_reference (must match `^vault:<uuid>$`), unique `(client_id, source)`. A pointer only — no key material in Postgres. The app reads `client_id`, `source`, `created_at` (via `listConnections()` for `/connections`); `credential_reference` is selected by no code path.
- `metrics_snapshots`: id uuid PK, client_id FK, source, run_id (1–512 chars), metrics jsonb (non-empty array), synced_at, created_at, unique `(client_id, source, run_id)` — immutable, append-only.
- `keyword_rankings`: PK `(snapshot_id, metric_index)`, client_id FK, source, keyword, rank numeric ≥ 0, synced_at. FK to `metrics_snapshots` is `on delete cascade`, so deleting a snapshot deletes its keyword rows — hence invariant 7.
- `current_metrics`: PK `(client_id, source)`, snapshot_id FK, run_id, metrics jsonb, synced_at, is_stale.
- `sync_logs`: id uuid PK, client_id FK, source, stage (`queue`|`sync`|`transform`|`cache`), status (`queued`|`success`|`partial`|`failed`|`skipped`), message (1–2000 chars), job_id, created_at — audit trail. Writers are `writeSyncLog()` (`lib/db/repository.ts`, zero non-test callers) and `scripts/seed.mjs`; no live sync path populates it.

## Auth & Multi-Tenancy Model

- Supabase Auth handles sign-in UI, session management, and JWTs.
- Google OAuth and email/password sign-in via Supabase Auth; email sign-up requires confirmation.
- Email confirmation and password recovery exchange PKCE codes at `/auth/callback`; recovery continues only to `/auth/reset-password`.
- Sign-up creates only an Auth identity; application roles/client assignments remain separately provisioned. No schema or RLS changes.
- Supabase JWT sub claim stores user identity; client_id FK links user to client.
- Roles: `admin` (full access), `client` (own data only), `staff` (assigned clients).
- Tenant gate: `canAccessClient(clientId)` and `listAccessibleClients()` (`lib/db/repository.ts`) read `clients` **as the signed-in user**, so Postgres RLS (`clients_select_authenticated`) decides visibility instead of a TypeScript copy of the rule. `listConnections()` chains the same cookie-bound client over `clients` then `api_credentials` (`api_credentials_select_tenant_or_admin`) and adds no rule of its own.
- Metric reads (`metrics_snapshots`, `current_metrics`, `keyword_rankings`) still run on the service-role client so `unstable_cache` stays request-independent, but only for a `client_id` that already passed the RLS gate. `getAdminDb()` is reserved for cron/worker paths (queueing every active client, `persist_metrics`, sync logs).
- Clients can never access another client's rows: the id set they can name is RLS-derived, and the same policies filter a direct PostgREST read.
- `requireAdmin()` (`lib/agents/authAgent.ts`) is the role gate, and `/admin` plus the three `/api/admin/*` handlers call it — the first route family that needed it. There is no `middleware.ts`; the root `proxy.ts` only refreshes the session cookie and redirects an anonymous visitor off `/admin`, which is the outer of two gates: the page and each handler re-ask `requireAdmin()`, and the RPC's own `42501` guard is the one that actually binds. An admin route must use `requireAdmin()`, never a fresh role check.
- Both secret-guarded routes (`cron/sync`, `revalidate/dashboard`) go through `verifyCronSecret()`: 503 when `CRON_SECRET` is unset, 401 on a bearer mismatch. Configurable-but-unset is treated as unavailable, never as "open".
- API credentials: `api_credentials` stores a `vault:<uuid>` reference, never key material, so nothing lands in `.env` or the browser. `20260925000000_connections_read.sql` replaced the closed `using (false)` policy with `api_credentials_select_tenant_or_admin` (the same admin-or-own-tenant predicate as `clients`), which is what lets `/connections` read a tenant's status rows. Resolving the reference and calling the sources is still part of the unbuilt sync agent.

## HTTP API — implemented

Seven tenant-scoped route handlers exist. Every one of them: validate the `{clientId}` path param → resolve identity → pass the RLS-backed tenant gate → read or delegate. Precedence is 400 malformed id → 401 unauthenticated → 403 not this caller's client → 503 database failure; the two export routes add 429 (`Retry-After`) once the sliding-window quota is spent. Only path/query validation runs before that 503 handler — the identity read and the tenant gate are awaited inside its `try`, so a Supabase outage or missing config is a JSON 503, never an unhandled 500 and never a misleading 401. Tenant gates go through `listAccessibleClients()` / `canAccessClient()`, never a TypeScript re-derivation.

The three `/api/admin/*` handlers (`lib/admin/http.ts` owns their shape) replace that order with
`requireAdmin()` → path-param uuid → body → zod → `callAdminRpc` → code→status, so the role guard and
validation run **before any table is touched**, and their error bodies come only from
`lib/admin/errors.ts`. They are writes, so they do not use `databaseOperation()` — that wrapper erases
the Postgres `code`, which is the whole payload of the error map.

- `GET /api/dashboard/boot` — the dashboard's single boot request: `{ profile, clients, selection: { clientId, days, payload: { overview, history } } }` for the URL's `?client=&days=`, falling back to the first accessible client and `DASHBOARD_RANGES[0]`. `no-store` + `Vary: Cookie`.
- `GET /api/metrics/{clientId}/overview` — `{ overview, history }` from `current_metrics` + `keyword_rankings` via `unstable_cache`; `?days=` must be a `DASHBOARD_RANGES` member or it silently falls back to the default. `s-maxage=300, stale-while-revalidate=60`.
- `GET /api/metrics/{clientId}/keywords` — keyword rank time series grouped per keyword, best rank first, as the `{ data, meta }` envelope; `?source=` (`gsc` default) + `?from`/`?to` ISO (default: last 30 days). Same `s-maxage=300, stale-while-revalidate=60`.

Cache-bound invariant (both metrics routes, 200 path only): `s-maxage` == client `CACHE_TTL_MS` == `unstable_cache revalidate` == **300s**, so CDN, browser, and server caches expire on one bound. A 2026-09-21 revert to 60s (`58599ac`, no rationale recorded) was resolved back to 300 on 2026-09-24; route unit tests now pin the header string.
- `GET /api/exports/{clientId}/csv` — `text/csv; charset=utf-8` attachment. Filename is ASCII-slugged (`<client-slug>-metrics-<days>d-<YYYY-MM-DD>.csv`) by `lib/exports/filename.ts`, so non-ASCII client names never reach the header.
- `GET /api/exports/{clientId}/pdf` — `application/pdf` attachment, same filename scheme with `-report-`. 503 JSON when `renderPdfReport()` throws — never a 200 with an empty body.
- `POST /api/revalidate/dashboard` — `revalidateTag(DASHBOARD_OVERVIEW_TAG)`, guarded by `Authorization: Bearer <CRON_SECRET>`. `revalidateTag` throws outside a request context, which is why the standalone worker POSTs here (`lib/cache/notify.ts`) instead of calling it.
- `GET /api/cron/sync` — Vercel cron (`vercel.json`, `GET`, bearer `CRON_SECRET`): iterates `listActiveClients()` and queues one BullMQ job per client with `Promise.allSettled`; returns `{ queued, errors }`. Jobs are consumed by `lib/queue/worker.ts`, which currently returns `mock_completed` without touching the sources.
- `GET /connections` — a **page**, not a route handler, and the app's only server-rendered read of *tenant* rows (`/profile` reads only the caller's own `users` row; every metric read goes through `/api/*`): the page awaits `listConnections()` (clients, then `api_credentials`) as the signed-in user, so RLS decides the row set. Nothing cached; the segment declares `dynamic = "force-dynamic"` for the reason recorded under Invariants.

## HTTP API — planned, not built

`POST /api/sync/trigger`, `GET /api/sync/logs/{clientId}`, `GET /api/metrics/{clientId}`, `GET /api/metrics/{clientId}/history` are target-state shapes only — full contract in `docs/target-state.md`. Do not treat them as existing when writing client code.

## Sync Agent Model — target state, not built

No `syncAgent`, `transformAgent`, `cacheAgent`, or `insightsAgent` exists; `lib/queue/worker.ts` returns `mock_completed`. The shape below is the contract to build against (full version in `docs/target-state.md`), so it is written as requirements, not as a description of current behavior.

### Daily Sync Job
- Input: clientId, API credentials from Supabase Vault.
- Execution: BullMQ job queued by cron, runs at 2 AM daily.
- Parallel API calls: GSC + GA4 + Semrush via Promise.allSettled (partial failure safe).
- Each source fails independently — partial success still writes available data.
- Retry: exponential backoff (3 attempts per source, 1s → 4s → 16s).
- Circuit breaker: pause client sync after 5 consecutive failures, alert admin.
- Output: appended metrics_snapshots rows + updated current_metrics cache.

### AI Insight Generation
- Input: current_metrics + last 30-day metrics_snapshots for client.
- Execution: inline Claude API call (not a background job — runs on demand).
- Output: plain-English summary cached in current_metrics as `ai_summary` metric.
- Cache TTL: 24hrs (don't regenerate every request).

## Invariants

1. Route handlers never run sync jobs inline — always delegate to BullMQ.
2. Metric data and credentials stored in separate layers (Postgres vs. Vault).
3. Auth and ownership enforced at every mutation boundary + backed by RLS.
4. Client-ownership is decided only by the RLS-backed gate (`canAccessClient`, `listAccessibleClients`) — no route or helper may re-implement the "is this the caller's client?" rule in TypeScript.
5. Supabase anon key may be exposed to browser; service-role key never leaves server.
6. Client components only where interactivity requires (dashboard charts, date pickers).
7. metrics_snapshots are append-only — never update or delete historical rows.
8. Every Supabase table has RLS enabled with policies matching ownership/role model.
9. is_stale flag set server-side — client UI reads it, never computes staleness itself.
10. API credentials never logged, never returned in API responses.
11. The Next data-cache tag for the dashboard is owned by `lib/cache/invalidate.ts` (`DASHBOARD_OVERVIEW_TAG = "dashboard-overview"`) and only revalidated through `app/api/revalidate/dashboard` (secret-guarded) — never called from the worker process directly.
12. `/dashboard` stays a prerendered static shell (`○`): all auth-dependent data arrives client-side, and the whole boot payload comes from **one** `GET /api/dashboard/boot` request. While that request is in flight `DashboardView` must render `DashboardSkeleton` — returning `null` there blanks the skeleton the shell already painted. Identity + role reads go through `getAuthSession()` (one `auth.getUser()` + one `users` read per request); do not pair `getUser()` with `getAuthUser()` in a handler, that repeats both round trips.

**How invariants 4-5 apply to `/connections` (applied deliberately, not forgotten).** `listConnections()`
is never wrapped in `unstable_cache`, and `app/(app)/connections/page.tsx` declares
`export const dynamic = "force-dynamic"` — the app's only server-rendered tenant read, so it opts out of
the data cache entirely rather than keying a cookie-bound client on nothing. The `force-dynamic` line
is load-bearing: the cookie read happens inside `databaseOperation()`, whose catch-all converts Next's
prerender bailout into `Error("Database operation failed")`, so removing it fails `pnpm build`. The
shared `lib/db` wrapper defect behind that behaviour is a separate, later change and stays open on
purpose — do not "clean up" either line here.
