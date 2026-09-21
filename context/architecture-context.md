# Architecture Context

## Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Framework | Next.js 16 + TypeScript | Full-stack app, server/client boundaries |
| UI | Tailwind 4 + shadcn/ui | Component composition and styling |
| Auth | Supabase Auth + Google OAuth | Identity, sessions, route protection |
| Database | Supabase Postgres | Clients, metrics, credentials, sync logs |
| Database client | `@supabase/supabase-js` | Server-side DB access with JWT tokens |
| Background tasks | BullMQ + Upstash Redis | Daily sync jobs, retry, circuit breaker |
| Cache | Upstash Redis | Stale-data flags, TTL per client per source |
| AI Insights | Claude API (claude-sonnet-4-6) | Plain-English performance summaries |
| Deployment | Vercel | App hosting, cron triggers, env management |

## System Boundaries

- `app/api` — authenticated route handlers: input validation, ownership checks, DB mutations, sync job triggering.
- `lib/agents` — sync, transform, cache, auth agents (see AGENTS.md).
- `lib/queue` — BullMQ job definitions, retry logic, circuit breaker.
- `lib/supabase` — Supabase client construction with JWT access tokens.
- `lib/db` — persistence operations: metrics, clients, credentials, sync logs.
- `components` — UI: dashboard widgets, metric cards, admin panel, stale banners.
- `types` — shared TypeScript contracts for metrics, clients, API responses.
- `supabase/migrations` — versioned Postgres schema, RLS policies, indexes.

## Storage Model

- **Supabase Postgres**: clients, api_credentials, metrics_snapshots, keyword_rankings, current_metrics, sync_logs, users.
- **No external blob storage**: all metric data stored directly in Postgres (no large artifacts).
- Database stores metric values as typed columns + JSONB metadata (not raw API responses).
- Immutable snapshots (metrics_snapshots) — never overwrite, always append.
- Denormalized cache (current_metrics) — fast dashboard reads, updated after each sync.
- Dashboard reads cached in the Next data cache via `unstable_cache` (tag `dashboard-overview`), invalidated after syncs through the revalidation route above.

### Persistence Schema

- `clients`: UUID, name, is_active, created_at.
- `users`: UUID (Supabase Auth), email, role (admin|client|staff), client_id FK.
- `api_credentials`: client_id FK, platform enum, encrypted_api_key, oauth_refresh_token, last_synced, status.
- `metrics_snapshots`: client_id FK, date, platform, metric_type, value, metadata JSONB — immutable, append-only.
- `keyword_rankings`: client_id FK, keyword, date, rank_position, search_volume, difficulty — time-series.
- `current_metrics`: client_id FK, metric_name, value, last_updated, is_stale — denormalized for fast reads.
- `sync_logs`: client_id FK, platform, status, error_message, records_synced, duration_ms — audit trail.

## Auth & Multi-Tenancy Model

- Supabase Auth handles sign-in UI, session management, and JWTs.
- Google OAuth and email/password sign-in via Supabase Auth; email sign-up requires confirmation.
- Email confirmation and password recovery exchange PKCE codes at `/auth/callback`; recovery continues only to `/auth/reset-password`.
- Sign-up creates only an Auth identity; application roles/client assignments remain separately provisioned. No schema or RLS changes.
- Supabase JWT sub claim stores user identity; client_id FK links user to client.
- Roles: `admin` (full access), `client` (own data only), `staff` (assigned clients).
- RLS enforced at DB layer — not bypassable via API.
- Clients can never access another client's rows, even if API is compromised.
- Admin routes protected via role check middleware.
- API credentials stored in Supabase Vault — never in .env or client-side.

## Sync API

- `POST /api/sync/trigger` — manually trigger sync for one client (admin only).
- `GET /api/cron/sync` — Vercel cron endpoint (crons are invoked with `GET`; `Authorization: Bearer <CRON_SECRET>` via `vercel.json`), iterates `listActiveClients()` and queues one BullMQ job per client with `Promise.allSettled`; returns `{ queued, errors }`.
- `POST /api/revalidate/dashboard` — internal endpoint the BullMQ worker pokes after each sync job to `revalidateTag("dashboard-overview")`; `revalidateTag` throws outside a request context, so the standalone worker cannot call it directly — it POSTs here via `lib/cache/notify.ts` (`CRON_SECRET` bearer, no-ops when no app URL or secret).
- `GET /api/sync/logs/{clientId}` — retrieve sync history for client.
- `GET /api/metrics/{clientId}` — fetch current_metrics for dashboard (fast read).
- `GET /api/metrics/{clientId}/history` — fetch metrics_snapshots with date range filter.
- `GET /api/metrics/{clientId}/keywords` — fetch keyword rank time series (`keyword_rankings` grouped per keyword, best rank first); esp: `source` (`gsc` default) + `from`/`to` ISO; `enforceClientAccess` (401/403).
- `GET /api/dashboard/boot` — the dashboard's single boot request: `{ profile, clients, selection: { clientId, days, payload: { overview, history } } }` for the URL's `?client=&days=` (validated, falling back to the first accessible client and `DASHBOARD_RANGES[0]`). `no-store` + `Vary: Cookie`; 400 malformed id, 401 unauthenticated, 503 on read failure.

Route handlers stay thin: auth check → validate input → delegate to `lib/db` or `lib/queue`.

## Sync Agent Model

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
4. Supabase anon key may be exposed to browser; service-role key never leaves server.
5. Client components only where interactivity requires (dashboard charts, date pickers).
6. metrics_snapshots are append-only — never update or delete historical rows.
7. Every Supabase table has RLS enabled with policies matching ownership/role model.
8. is_stale flag set server-side — client UI reads it, never computes staleness itself.
9. API credentials never logged, never returned in API responses.
10. The Next data-cache tag for the dashboard is owned by `lib/cache/invalidate.ts` (`DASHBOARD_OVERVIEW_TAG = "dashboard-overview"`) and only revalidated through `app/api/revalidate/dashboard` (secret-guarded) — never called from the worker process directly.
11. `/dashboard` stays a prerendered static shell (`○`): all auth-dependent data arrives client-side, and the whole boot payload comes from **one** `GET /api/dashboard/boot` request. While that request is in flight `DashboardView` must render `DashboardSkeleton` — returning `null` there blanks the skeleton the shell already painted. Identity + role reads go through `getAuthSession()` (one `auth.getUser()` + one `users` read per request); do not pair `getUser()` with `getAuthUser()` in a handler, that repeats both round trips.