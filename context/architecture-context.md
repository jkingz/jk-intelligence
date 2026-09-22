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
- `lib/auth` — `cron.ts` (timing-safe bearer check for cron/revalidate) and `routing.ts` (the `proxy.ts` decision table for `/dashboard` + `/profile`, and open-redirect-safe `next`). Both tested.
- `lib/queue` — BullMQ queue definition (`seo-sync`) + worker entrypoint. Retry policy and circuit breaker are target-state, not code.
- `lib/cache` — `invalidate.ts` owns the dashboard tag; `notify.ts` lets the worker ask the app to revalidate.
- `lib/supabase` — client construction (per-request user client + service-role client).
- `lib/db` — persistence + the RLS-backed tenant gate. `admin.ts` isolates the service-role client.
- `lib/dashboard` — read-model assembly (`overview.ts`, `keywords.ts`) shared by the boot and metrics routes, so both return identical shapes.
- `lib/exports` — server-side CSV/PDF assembly, dataset builder, `quota.ts` (per-user export budget), `fonts/` for PDF unicode.
- `lib/rate-limit.ts` — `SlidingWindowLimiter`; throttles auth actions client-side and backs the export quota server-side.
- `components` — `components/ui/*` (shadcn, protected) + `components/features/*` (dashboard widgets, metric cards, stale banners, auth forms, export menu). No admin panel yet.
- `types` — `database.ts` is handwritten; generated types are an open item.
- `supabase/migrations` — `20260917000000_seo_poc.sql`, `20260920000000_add_staff_role.sql`, `20260920000001_rls_hardening.sql`.

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
- `api_credentials`: client_id FK, source (`gsc`|`ga4`|`semrush`), credential_reference (must match `^vault:<uuid>$`), unique `(client_id, source)`. A pointer only — no key material in Postgres, and no code path reads it yet.
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
- Tenant gate: `canAccessClient(clientId)` and `listAccessibleClients()` (`lib/db/repository.ts`) read `clients` **as the signed-in user**, so Postgres RLS (`clients_select_authenticated`) decides visibility instead of a TypeScript copy of the rule.
- Metric reads (`metrics_snapshots`, `current_metrics`, `keyword_rankings`) still run on the service-role client so `unstable_cache` stays request-independent, but only for a `client_id` that already passed the RLS gate. `getAdminDb()` is reserved for cron/worker paths (queueing every active client, `persist_metrics`, sync logs).
- Clients can never access another client's rows: the id set they can name is RLS-derived, and the same policies filter a direct PostgREST read.
- `requireAdmin()` (`lib/agents/authAgent.ts`) is the role gate, but **no route calls it yet** — there are no admin-only endpoints. There is no `middleware.ts`; the root `proxy.ts` only refreshes the session cookie. When an admin route is added, it must use `requireAdmin()`, not a fresh role check.
- Both secret-guarded routes (`cron/sync`, `revalidate/dashboard`) go through `verifyCronSecret()`: 503 when `CRON_SECRET` is unset, 401 on a bearer mismatch. Configurable-but-unset is treated as unavailable, never as "open".
- API credentials: `api_credentials` stores a `vault:<uuid>` reference and RLS denies direct select, so no key material ever lands in Postgres, `.env`, or the browser. Resolving that reference and calling the sources is part of the unbuilt sync agent.

## HTTP API — implemented

Seven route handlers exist. Every one of them: validate the `{clientId}` path param → resolve identity → pass the RLS-backed tenant gate → read or delegate. Precedence is 400 malformed id → 401 unauthenticated → 403 not this caller's client → 503 read failure; the two export routes add 429 (`Retry-After`) once the sliding-window quota is spent. Tenant gates go through `listAccessibleClients()` / `canAccessClient()`, never a TypeScript re-derivation.

- `GET /api/dashboard/boot` — the dashboard's single boot request: `{ profile, clients, selection: { clientId, days, payload: { overview, history } } }` for the URL's `?client=&days=`, falling back to the first accessible client and `DASHBOARD_RANGES[0]`. `no-store` + `Vary: Cookie`.
- `GET /api/metrics/{clientId}/overview` — `{ overview, history }` from `current_metrics` + `keyword_rankings` via `unstable_cache`; `?days=` must be a `DASHBOARD_RANGES` member or it silently falls back to the default. `s-maxage=60, stale-while-revalidate=60`.
- `GET /api/metrics/{clientId}/keywords` — keyword rank time series grouped per keyword, best rank first, as the `{ data, meta }` envelope; `?source=` (`gsc` default) + `?from`/`?to` ISO (default: last 30 days).
- `GET /api/exports/{clientId}/csv` — `text/csv; charset=utf-8` attachment. Filename is ASCII-slugged (`<client-slug>-metrics-<days>d-<YYYY-MM-DD>.csv`) by `lib/exports/filename.ts`, so non-ASCII client names never reach the header.
- `GET /api/exports/{clientId}/pdf` — `application/pdf` attachment, same filename scheme with `-report-`. 503 JSON when `renderPdfReport()` throws — never a 200 with an empty body.
- `POST /api/revalidate/dashboard` — `revalidateTag(DASHBOARD_OVERVIEW_TAG)`, guarded by `Authorization: Bearer <CRON_SECRET>`. `revalidateTag` throws outside a request context, which is why the standalone worker POSTs here (`lib/cache/notify.ts`) instead of calling it.
- `GET /api/cron/sync` — Vercel cron (`vercel.json`, `GET`, bearer `CRON_SECRET`): iterates `listActiveClients()` and queues one BullMQ job per client with `Promise.allSettled`; returns `{ queued, errors }`. Jobs are consumed by `lib/queue/worker.ts`, which currently returns `mock_completed` without touching the sources.

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