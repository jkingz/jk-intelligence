# Architecture Context

### Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Framework | Next.js 16 + TypeScript | Full-stack app, server/client boundaries |
| UI | Tailwind 4 + shadcn/ui | Component composition and styling |
| Auth | Supabase Auth + Google OAuth | Identity, sessions, route protection |
| Database | Supabase Postgres | Clients, metrics, credentials, sync logs |
| Database client | `@supabase/supabase-js` | Server-side DB access with JWT tokens |
| Background tasks | BullMQ + Upstash Redis | **Partly built:** queue + worker process exist; the worker performs no sync (returns `mock_completed`) and has no production host |
| Cache | Upstash Redis + Next `unstable_cache` | Data-cache tag `dashboard-overview`; the planned stale-flag TTL lives only in the target design |
| AI Insights | Claude API | **Not built** — see § TARGET STATE |
| Deployment | Vercel | App hosting, cron trigger, env management. CI: `.github/workflows/ci.yml` |

### System boundaries

- `app/api` — route handlers: validate → guard → read/delegate.
- `lib/api` — `guard.ts`: the response shape (`NO_STORE`, `json`, `badRequest`/`unauthorized`/`forbidden`/`databaseFailure`) and the gates (`gateNullable`, `gateSession`, `gateAdmin`, `gateClientAccess`, `resolveAccessibleClient`) shared by the session-gated route files, which § HTTP surface enumerates. It owns no ownership rule — the tenant gates forward to `canAccessClient` / `listAccessibleClients`.
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
  source of admin **Postgres** error copy: sqlstate → status + sentence; the gate's own 401/403/503
  bodies come from `lib/api/guard.ts`), `rpc.ts` (`callAdminRpc`, which keeps
  `error.code` — the reason admin writes do not run through `databaseOperation()`), `provisioning.ts`
  (`getAdminView()`: two RLS-backed selects plus the `admin_directory`
  RPC, joined in TypeScript). It never touches `getAdminDb()`.
- `lib/exports` — server-side CSV/PDF assembly, dataset builder, `quota.ts` (per-user export budget), `fonts/` for PDF unicode.
- `lib/rate-limit.ts` — `SlidingWindowLimiter`; throttles auth actions client-side and backs the export quota server-side.
- `components` — `components/ui/*` (shadcn, protected) + `components/features/*` (the `app-shell`
  rail, dashboard widgets, metric cards, stale banners, auth forms, export menu, connection status
  rows, and `admin/` — the provisioning panel, its two tables and two dialogs).
- `types` — `database.ts` is handwritten; generated types are an open item.
- `supabase/migrations` — Policies: see § SERVICE ARCHITECTURE → Tenant isolation.

### Storage model

- **Supabase Postgres**: clients, api_credentials, metrics_snapshots, keyword_rankings, current_metrics, sync_logs, users.
- **No external blob storage**: all metric data stored directly in Postgres (no large artifacts).
- Metric values are **not** typed columns. Each sync run writes a non-empty JSONB array to `metrics_snapshots.metrics`; `current_metrics` holds a copy pointing at that snapshot. Only `keyword_rankings` is stored as typed columns.
- Immutable snapshots (metrics_snapshots) — never overwrite, always append. Uniqueness `(client_id, source, run_id)` makes a re-run idempotent.
- Denormalized cache (current_metrics) — one row per `(client_id, source)`, primary read path for the dashboard.
- Dashboard reads cached in the Next data cache via `unstable_cache` (tag `dashboard-overview`), invalidated after syncs through the revalidation route above.

#### Persistence schema

Verified against `supabase/migrations/*` — not from the original spec.

- `clients`: id uuid PK, name, **domain** (unique on `lower(domain)`), is_active, created_at.
- `users`: id uuid PK → `auth.users` on delete cascade, role (`admin`|`client`|`staff`, default `client`), client_id FK (on delete set null), created_at. **No email column** — email lives in `auth.users`. Constraint `users_admin_has_no_tenant`: `admin` must have `client_id is null`.
- `api_credentials`: client_id FK, source (`gsc`|`ga4`|`semrush`), credential_reference (must match `^vault:<uuid>$`), unique `(client_id, source)`. A pointer only — no key material in Postgres. The app reads `client_id`, `source`, `created_at` (via `listConnections()` for `/connections`); `credential_reference` is selected by no code path, and on the migrated local stack Postgres refuses it to `authenticated` rather than leaving it to convention — see § SERVICE ARCHITECTURE → Tenant isolation.
- `metrics_snapshots`: id uuid PK, client_id FK, source, run_id (1–512 chars), metrics jsonb (non-empty array), synced_at, created_at, unique `(client_id, source, run_id)` — immutable, append-only.
- `keyword_rankings`: PK `(snapshot_id, metric_index)`, client_id FK, source, keyword, rank numeric ≥ 0, synced_at. FK to `metrics_snapshots` is `on delete cascade`, so deleting a snapshot deletes its keyword rows — hence invariant 7.
- `current_metrics`: PK `(client_id, source)`, snapshot_id FK, run_id, metrics jsonb, synced_at, is_stale.
- `sync_logs`: id uuid PK, client_id FK, source, stage (`queue`|`sync`|`transform`|`cache`), status (`queued`|`success`|`partial`|`failed`|`skipped`), message (1–2000 chars), job_id, created_at — audit trail. Writers are `writeSyncLog()` (`lib/db/repository.ts`, zero non-test callers) and `scripts/seed.mjs`; no live sync path populates it.

### Auth & tenancy model

- Supabase Auth handles sign-in UI, session management, and JWTs.
- Google OAuth and email/password sign-in via Supabase Auth; email sign-up requires confirmation.
- Email confirmation and password recovery exchange PKCE codes at `/auth/callback`; recovery continues only to `/auth/reset-password`.
- Sign-up creates only an Auth identity; application roles/client assignments remain separately provisioned. No schema or RLS changes.
- Supabase JWT sub claim stores user identity; client_id FK links user to client.
- Roles: `admin` (full access), `client` (own data only), `staff` (assigned clients).
- Tenant gate: `canAccessClient(clientId)` and `listAccessibleClients()` (`lib/db/repository.ts`) read `clients` **as the signed-in user**, so Postgres RLS (`clients_select_authenticated`) decides visibility instead of a TypeScript copy of the rule. `listConnections()` chains the same cookie-bound client over `clients` then `api_credentials` (`api_credentials_select_tenant_or_admin`) and adds no rule of its own.
- Metric reads (`metrics_snapshots`, `current_metrics`, `keyword_rankings`) still run on the service-role client so `unstable_cache` stays request-independent, but only for a `client_id` that already passed the RLS gate. `getAdminDb()` is reserved for cron/worker paths (queueing every active client, `persist_metrics`, sync logs).
- Clients can never access another client's rows: the id set they can name is RLS-derived, and the same policies filter a direct PostgREST read.
- `requireAdmin()` (`lib/agents/authAgent.ts`) is the role gate: the `/admin` page calls it directly, and the three `/api/admin/*` handlers reach it through the guard's `gateAdmin()` — the first route family that needed it. There is no `middleware.ts`; the root `proxy.ts` only refreshes the session cookie and redirects an anonymous visitor off `/admin`, which is the outer of two gates: the page and each handler re-ask `requireAdmin()`, and the RPC's own `42501` guard is the one that actually binds. An admin route must use `gateAdmin()`/`requireAdmin()`, never a fresh role check.
- Both secret-guarded routes (`cron/sync`, `revalidate/dashboard`) go through `verifyCronSecret()`: 503 when `CRON_SECRET` is unset, 401 on a bearer mismatch. Configurable-but-unset is treated as unavailable, never as "open".
- API credentials: `api_credentials` stores a `vault:<uuid>` reference, never key material, so nothing lands in `.env` or the browser. `20260925000000_connections_read.sql` replaced the closed `using (false)` policy with `api_credentials_select_tenant_or_admin` (the same admin-or-own-tenant predicate as `clients`), which is what lets `/connections` read a tenant's status rows. Resolving the reference and calling the sources is still part of the unbuilt sync agent.

### Invariants

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
12. `/dashboard` stays a prerendered static shell (`○`): all auth-dependent data arrives client-side, and the dashboard's whole boot payload comes from **one** `GET /api/dashboard/boot` request. While that request is in flight `DashboardView` must render `DashboardSkeleton` — returning `null` there blanks the skeleton the shell already painted. Identity + role reads go through `getAuthSession()` (one `auth.getUser()` + one `users` read per request); do not pair `getUser()` with `getAuthUser()` in a handler, that repeats both round trips.
13. The app shell may not read a session, a cookie, or `getProfileView()` server-side — that would make every page in `app/(app)/` dynamic. The one piece of identity it shows, the rail's account block, fetches `GET /api/auth/me` after hydration, and its collapse preference lives in `localStorage` rather than the sidebar primitive's own cookie for the same reason. So a rendered authenticated page now issues two client-side auth reads (`/api/auth/me` from the shell, `/api/dashboard/boot` from the dashboard), and `/api/auth/me` is the one that answers on every page.

**How invariants 4-5 apply to `/connections` (applied deliberately, not forgotten).** `listConnections()`
is never wrapped in `unstable_cache`, and `app/(app)/connections/page.tsx` declares
`export const dynamic = "force-dynamic"` — a server-rendered tenant read, the only one besides `/admin`,
whose `getAdminView()` lists an admin's whole client set through the same user-scoped client (`/profile`
reads only the caller's own `users` row; every metric read goes through `/api/*`), so it opts out of
the data cache entirely rather than keying a cookie-bound client on nothing. The `force-dynamic` line
is load-bearing: the cookie read happens inside `databaseOperation()`, whose catch-all converts Next's
prerender bailout into `Error("Database operation failed")`, so removing it fails `pnpm build`. The
shared `lib/db` wrapper defect behind that behaviour is a separate, later change and stays open on
purpose — do not "clean up" either line here.

