<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# STANDING RULES — Read first, before any task

Constraints that apply to every change. Read these in full before every taskable request. Skip nothing.

Rules 1–10 are the **portable core** — they hold in every repo this workspace touches, and belong in any new project's `AGENTS.md` § STANDING RULES verbatim. Rules 11–17 are **this repo's** appendix.

## Portable core — Rules 1–10

### 1. Be very concise
- Keep responses short. Sacrifice grammar for the sake of concision.
- No preamble, no "here is what I did" essays. State the change + the result + the one thing you need from me.

### 2. No "done" without a command behind it
- Every claim of completion names the command run and what it printed (`pnpm test` → `113 passed`; `curl` → the status code).
- Untested by you = unverified. Say "not verified" instead of "should work".
- Type-checking proves types, not behavior. CI passing proves the push, not the feature.

### 3. Scope is the request, not the opportunity
- The blast radius of a change equals the radius of what was asked. Fix the reported defect.
- No drive-by cleanup, renames, formatting, "while I'm here" extractions, predicted abstractions, or extra flags and compat shims.
- Nearby problems you spotted: **one line in the reply**. Not in the diff.
- Ask "was this in the request?" before touching it. If no, stop.

### 4. Delete unused, but prove it was unused
- Remove dead files, exports, imports, env vars, CSS, tokens and orphaned components as you go.
- Grep for callers before deleting; state what you removed and how you checked.
- Never delete a doc, branch, migration, or config you do not understand — report it instead.

### 5. Servers, ports, processes
- Restart or kill running servers/ports **only during the current task**.
- Clear stale processes on ports the app uses before starting your own.
- End a session with no orphaned dev server, queue worker, or background job. Stop what you started.

### 6. Secrets
- Never print a secret value — reference it by name. Redact anything that appears in output.
- `.env*` stays out of git. Only names and empty placeholders go into committed files.
- Service-role / privileged keys stay server-side, never in a `NEXT_PUBLIC_*` variable or the client bundle.

### 7. Git discipline
- Commit, push, open or merge a PR **only when asked**.
- Before pushing to `dev`: `git pull` from `origin main`, merge, resolve conflicts, then commit/push. Never push to `dev` without that pull.
- No `--no-verify`, no skipped hooks, no bypassed signing. A failing hook is a finding to fix at the cause.
- Never force-push a shared branch, and never `git reset --hard` / `clean -f` / `checkout --` over work you did not write. Check `git status` first; stash or commit anything unexpected.
- Destructive or externally visible actions (closing a PR, deleting a branch, dropping a table, sending messages) need explicit authorization — every time, not once-and-forever.

### 8. Pull-request babysitting
- When watching a PR: follow the `babysitting-a-pr` skill. Act only on checks and comments newer than the latest push, and verify every bot finding against the source before changing code.
- Every comment posted on my behalf follows `leaving-pr-comment`: its triggers, its body contract, and the mandatory first-line AI-authorship disclaimer.
- No filler comments. No scope creep while responding to review. A finding you decline gets a written decline, then the thread is resolved.

### 9. Skills and instructions come before improvising
- Check available skills before starting a task; if one applies, use it rather than re-deriving the workflow.
- A harness capability (scheduled runs, subagents, MCP tools) that exists is used — do not hand-write a loop the platform already provides.
- New reusable procedure worth keeping becomes a skill, tested before it is trusted.

### 10. Unknowns are labelled, not invented
- No fabricated thresholds, policies, precedents, APIs or file paths. If you cannot point at it, say you cannot point at it.
- State assumptions plus the step that would verify them. Missing requirement → record it as an open
  question, stop the branch of work that depends on it, and continue with the rest.
- When implementation and docs disagree, code is truth and the doc is a defect: fix the doc in the same change.

## Project-specific rules — Rules 11–17

### 11. Package manager and runtime
- pnpm only (`pnpm-lock.yaml`). `package-lock.json` was deleted deliberately — do not regenerate it with npm.
- Node `>=24` per `package.json` engines; patched dependency `next-themes` comes from `patches/`.

### 12. Next.js 16 is a fork of what you remember
- Read the matching guide in `node_modules/next/dist/docs/` before touching framework APIs (`proxy.ts` not `middleware.ts`, `RouteContext`, two-arg `revalidateTag`).
- Only the `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->` block is written
  and re-added by `next dev` — `upsertAgentRulesBlock()` in
  `node_modules/next/dist/server/lib/generate-agent-files.js` (Next 16.3.5) replaces the text between
  the markers and nothing else. Everything below it is hand-maintained; commit the block with your
  work rather than deleting it.

### 13. Verification gates
- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` must be green before reporting work complete; CI (`.github/workflows/ci.yml`) runs these four plus `pnpm test:e2e` (public tier only).
- Tests live in `tests/<feature>/<tier>/` — features `identity`, `tenant-isolation`, `dashboard`, `export`, `sync`, `landing`, `platform`; tiers `unit`, `integration`, `e2e`. `AGENTS.md` lists what each feature owns. Name the file `<sut>.test.ts` (unit/integration) or `<flow>.spec.ts` (e2e); import the **subject under test** through `@/`, never relatively — a `./` specifier can silently resolve to a neighbouring file of the same name. Shared helpers under `tests/helpers/` are the one exception and may be imported relatively.
- Unit tests mock at the boundary (`@/lib/agents/...`, `@/lib/db/repository`) — never inside business logic, and never make a real network or DB call. That last clause is **unit-tier only**: the integration tier exists precisely to put a real Postgres behind `canAccessClient`.
- `pnpm test` is the **unit project**, not the whole suite. The `integration` project is `tests/*/integration/**/*.test.ts`, run against the local stack: the two live-RLS files `tests/tenant-isolation/integration/rls-gate.test.ts` (`clients`) and `credentials-visibility.test.ts` (`api_credentials`), plus `tests/admin/integration/provisioning.test.ts` (admin `security definer` RPCs). All three gate on `describe.skipIf(!hasTestDb)`, where `tests/helpers/db.ts` derives `hasTestDb` from `TEST_SUPABASE_URL`, so a green tier can mean *nothing ran* — read the passed/skipped counts from the run, not the exit code. E2E is a separate runner. Run `pnpm test:all` and `pnpm test:e2e` before pushing. Narrow with `pnpm test dashboard`, never `pnpm test -- dashboard` — the latter silently runs everything.
- Route handlers get a `<name>-route.test.ts` covering 401 / 403 / 400 / 503 and the no-data-leaked-before-auth path.

### 14. Read order
§ STANDING RULES → then, for architectural decisions, § APPLICATION BUILDING CONTEXT in
order: Project Overview → Architecture Context → UI Context → Code Standards → Development Workflow
→ PM Conventions. Then § SERVICE ARCHITECTURE for what exists, § TARGET STATE for what does not.
Per-unit feature specs live in `specs/`. The rolling log at `docs/progress-tracker.md`
is history, not required reading: § Project Overview → Status and § Open product questions decide what
is current.

### 15. Tenant isolation is RLS's job
- Client-ownership is decided only by `canAccessClient` / `listAccessibleClients` in `lib/db/repository.ts`. No route or helper may re-implement that rule in TypeScript.
- § SERVICE ARCHITECTURE describes implemented code only; anything not built lives in § TARGET STATE.
  Never cite that section as current behavior, and check a module exists before assuming it does
  (`lib/agents/` holds only `authAgent`).

### 16. Supabase
- Schema changes are new timestamped files in `supabase/migrations/`, applied with `pnpm db:migrate`; never edit an applied migration.
- Never run a `db:*` script bare on this checkout — `db:migrate`, `db:seed` and `db:seed-connections` (whose `--reset` deletes rows) all read `SUPABASE_DB_URL`, and `.env` here targets hosted production with no `.env.local` to shadow it. Redirect the URL at the intended database first.
- Every table gets RLS matching the role model. `metrics_snapshots` is append-only. Provider key material and `credential_reference` never appear in a response or a log line; `api_credentials` status columns (`client_id`, `source`, `created_at`) may.
- Local runs need `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`; server-side also `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, and the private `DEMO_EMAIL`/`DEMO_PASSWORD` (server-read, prop-fed — never `NEXT_PUBLIC_*`, the login page would ship the password in the bundle). `.env.example` carries every name with placeholders; `.env.test` carries the `TEST_*` integration-tier names. Copy names, never values.
- CI needs only the two `NEXT_PUBLIC_*` values; `.github/workflows/ci.yml` sets non-secret placeholders so `pnpm build` can prerender.

### 17. UI conventions
- `next/image` `Image`, never raw `<img>`. SVG sources only if self-authored and script-free.
- shadcn/`components/ui/*` and `lib/supabase/*` are protected foundations: don't edit to make a feature pass.

# APPLICATION BUILDING CONTEXT

## Project Overview

### Status

**Built** — Supabase Auth (Google + email/password) with the RLS-backed tenant gate; a multi-client
dashboard (metric cards, trends, keyword rank chart, query table, date ranges) booting from one
`GET /api/dashboard/boot`; CSV/PDF export behind a sliding-window quota; a read-only `/connections`
status page; an admin provisioning panel at `/admin` with three `/api/admin/*` write routes; and the
`app/(app)/` shell whose destination rail lists **two** rows — Dashboard and Connections
(`lib/navigation/destinations.ts`).

**Not built** — real sync (`lib/queue/worker.ts` returns `mock_completed`; dashboard rows come from
`scripts/seed.mjs` and the `api_credentials` rows `/connections` renders from
`scripts/seed-connections.mjs`), any LLM integration (no `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY`, no
Claude call in the repo — and the "AI" surfaces are presentation only: `autonomous-brief.tsx` phrases
numbers it is handed, and `lib/dashboard/overview.ts` hardcodes `aiCitations: []`, so the citation grid
always renders its empty state), and a consumer for the `seo-sync` queue in production.

Verified: 2026-10-13, against the repo at the commit this section was ported into.

State of record for completed work: `docs/progress-tracker.md`.

### Overview

Multi-client automated SEO reporting platform. Clients and internal staff log in to view marketing and SEO performance data pulled daily from GSC, GA4, and SEO APIs. AI generates plain-English performance summaries. Admins manage clients, credentials, and sync jobs from a central admin panel.

### Goals

1. Authenticated multi-client access with strict data isolation.
2. Automated daily data syncing from GSC, GA4, Semrush/Ahrefs.
3. Historical metric storage and trend visualization.
4. AI-generated performance commentary per client.
5. Admin panel to add/manage clients and API credentials.
6. Resilient sync: API failure does not break dashboard.

### Core User Flow

1. User signs in (Google OAuth).
2. Client routed to own dashboard; admin routed to client list.
3. Dashboard loads from cache (current_metrics); stale banner shown if > 24hrs.
4. User views organic traffic, conversions, rankings, keyword movements.
5. User selects date range for historical comparison.
6. AI insight widget shows auto-generated summary of performance.
7. Admin adds new client → sets API credentials → activates daily sync.
8. Daily cron job syncs all clients → stores snapshots → updates cache.
9. User downloads CSV/PDF export of metrics.

Steps that do not execute today: 6 (no AI insight exists), 7's credential-and-activation half
(`api_credentials` is read-only; the panel writes clients and members only), and 8 (the cron
enqueues; nothing consumes it). Step 3 reads seeded rows.

### Scope

#### In Scope

- Google OAuth + route protection
- Multi-client data isolation (Supabase RLS)
- Admin panel: client + credential management
- GSC, GA4, Semrush/Ahrefs API integrations
- Automated daily sync with error handling + retry
- Historical metric storage (immutable snapshots)
- Denormalized current_metrics cache (fast dashboard loads)
- Stale-data detection + warning UI
- Keyword rankings time-series
- AI-generated performance summaries (Claude API)
- CSV + PDF export
- Sync audit logs

#### Out of Scope

- Billing and subscriptions
- White-label branding per client (Phase 3+)
- Competitor benchmarking (Phase 2+)
- Technical SEO health crawl (Phase 2+)
- Versioned spec history
- Mobile-native app (responsive web only)
- Slack/Zapier integrations

### Success Criteria

1. Client logs in, sees only their own data.
2. Daily sync runs without manual intervention.
3. Dashboard renders cached data even if all APIs are down.
4. Admin can add new client and activate sync in < 5 mins.
5. AI insight summary generated and displayed per client.
6. Historical trend visible across any custom date range.
7. CSV/PDF export works for any date range.
8. Sync failures logged, admin alerted, no dashboard crash.

### Open product questions

Compressed 2026-10-13 from the log's four live sections; the dated evidence behind each line stays in
`docs/progress-tracker.md`. Questions only — a line about what is not built belongs in § Project
Overview → Status, not here.

- **Who hosts the `seo-sync` worker** — an always-on process (Fly/Render), the cron calling sync
  inline, or QStash. Every real fetch waits on it, and so does the credential write behind the inert
  Connect button on `/connections`.
- **Whether to apply `20261010000000_credential_reference_unselectable.sql` to the hosted project.**
  It has run on the local stack only, so hosted `authenticated` still holds table-wide `select` on
  `api_credentials`; a hosted apply needs the owner's explicit yes, as every hosted migration here has.
- **How to stop the next `public` table arriving already open.** `pg_default_acl` grants
  `authenticated` and `anon` every table privilege on it, so the choice is one
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated` migration
  or a standing rule that each new table's migration revokes and re-grants its own columns.
- **How the `@auth` tier gets an admin account without breaking the integration tier.**
  `tests/admin/integration/provisioning.test.ts` asserts `admins == 1` globally and its attach case
  takes the first row with no `order by`, so the second admin — the `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  pair six `@auth` admin specs still wait on — makes a demotion succeed and the assertion fail, after
  the suite has mutated a row it does not own. Measured 2026-10-06: 2 failed / 17 passed with two
  admins, 19/19 with one. Either scope those two cases to `FIXTURE_USERS.admin`'s id or run `@auth`
  on a stack that never runs the integration tier; the first removes a landmine but edits a shipped,
  currently-green test file, and the second leaves the two tiers untestable on one machine.
- **Whether to stand up a hosted test database.** The integration tier `skipIf`s without
  `TEST_SUPABASE_URL`, so until that decision CI is unit + public e2e only.
- **What is actually configured on the hosted Supabase project** — Google OAuth enabled, the
  `/auth/callback` and `/auth/reset-password` redirect-URL allowlist, PKCE `token_hash` email
  templates. None of it is checkable from the local stack, so end-to-end OAuth and email flows stay
  unverified.
- **Which env vars are mirrored into Vercel production** — `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the Upstash pair, and the server-only
  `DEMO_EMAIL`/`DEMO_PASSWORD`. Where they are missing, the cron, the worker and the demo card simply
  do nothing.

## Architecture Context

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
- `lib/api` — `guard.ts`: the response shape (`NO_STORE`, `json`, `badRequest`/`unauthorized`/`forbidden`/`databaseFailure`) and the gates (`gateNullable`, `gateSession`, `gateAdmin`, `gateClientAccess`, `resolveAccessibleClient`) shared by the nine session-gated route files. It owns no ownership rule — the tenant gates forward to `canAccessClient` / `listAccessibleClients`.
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

## UI Context

### Theme

Dark/light mode supported. Default: dark. Toggle via `data-theme` attribute on `<html>`. Visual language: deep charcoal surfaces, fire-red accent, paper text, clean data-dense reporting UI. Palette adapted from structurewebworks.com.

All colors defined as CSS custom properties in `globals.css`, mapped to Tailwind via `@theme inline`. Components use tokens only — no hardcoded hex or raw Tailwind color classes like `zinc-*` or `slate-*`.

`components/ui/sidebar.tsx` ships `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `bg-sidebar-accent` and `ring-sidebar-ring` with no values of their own, so `@theme inline` aliases all six onto existing app tokens (`--bg-surface`, `--text-primary`, `--border-default`, `--accent-primary-dim`). Without the mapping these classes compile to no utility at all and the rail renders transparent — check that block before adding another primitive that brings its own token names. One gap is left on purpose: the primitive's unused `rounded` menu-button variant interpolates the *raw* `var(--sidebar-border)` / `var(--sidebar-accent)`, which nothing defines, so if that variant is ever adopted those need their own `:root` values.

#### Dark Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#0d0d0d` |
| Surface | `--bg-surface` | `#141414` |
| Elevated surface | `--bg-elevated` | `#1a1a1a` |
| Subtle surface | `--bg-subtle` | `#212121` |
| Default border | `--border-default` | `#2b2b2b` |
| Subtle border | `--border-subtle` | `#3d3d3d` |
| Primary text | `--text-primary` | `#fafafa` |
| Secondary text | `--text-secondary` | `#d0d0d0` |
| Muted text | `--text-muted` | `#b0b0b0` |
| Faint text | `--text-faint` | `#8a8a8a` |
| Brand accent (fire red) | `--accent-primary` | `#ff3b30` |
| Brand hover | `--accent-hover` | `#ff5f52` |
| Brand dim | `--accent-primary-dim` | `rgba(255, 59, 48, 0.18)` |
| AI accent | `--accent-ai` | `#b0b0b0` |
| AI text | `--accent-ai-text` | `#d8d8d8` |
| Positive / up | `--state-success` | `#8fbf5a` |
| Negative / down | `--state-error` | `#f08e7d` |
| Warning / stale | `--state-warning` | `#f6c669` |
| Neutral / flat | `--state-neutral` | `#8a8a8a` |

#### Light Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#fafafa` |
| Surface | `--bg-surface` | `#f2f2f2` |
| Elevated surface | `--bg-elevated` | `#ebebeb` |
| Subtle surface | `--bg-subtle` | `#e4e4e4` |
| Default border | `--border-default` | `#dcdcdc` |
| Subtle border | `--border-subtle` | `#c8c8c8` |
| Primary text | `--text-primary` | `#171717` |
| Secondary text | `--text-secondary` | `#3d3d3d` |
| Muted text | `--text-muted` | `#4f4f4f` |
| Faint text | `--text-faint` | `#5a5a5a` |
| Brand accent (fire red) | `--accent-primary` | `#b91c1c` |
| Brand hover | `--accent-hover` | `#991b1b` |
| Brand dim | `--accent-primary-dim` | `rgba(185, 28, 28, 0.10)` |
| AI accent | `--accent-ai` | `#4f4f4f` |
| AI text | `--accent-ai-text` | `#3d3d3d` |
| Positive / up | `--state-success` | `#336d18` |
| Negative / down | `--state-error` | `#b3261e` |
| Warning / stale | `--state-warning` | `#7d5800` |
| Neutral / flat | `--state-neutral` | `#4f4f4f` |

#### globals.css Pattern

```css
:root,
[data-theme="dark"] {
  /* dark mode defaults */
  --bg-base: #0d0d0d;
  --accent-primary: #ff3b30;
  /* ... */
}

[data-theme="light"] {
  --bg-base: #fafafa;
  --accent-primary: #b91c1c;
  /* ... */
}
```

The dark block is declared on `:root` **and** on any `[data-theme="dark"]` element — same values, scoped
locally — so a subtree can pin dark without a toggle. `AuthPageShell` does exactly that on both its
branches (`components/features/email-password-auth/components/auth-page-shell.tsx:19,29`), because no
theme control exists on an auth route, and `tests/identity/unit/auth-dark-default.test.ts:33` asserts the
two-selector form in the stylesheet.

Toggle: set `document.documentElement.dataset.theme = 'light' | 'dark'`. Persist to localStorage.

---

### Typography

| Role | Font | CSS Variable |
|------|------|-------------|
| UI text | Geist Sans | `--font-geist-sans` |
| Code / mono | Geist Mono | `--font-geist-mono` |
| Metric numbers | Geist Mono | `--font-geist-mono` |

Both served from `app/fonts/` through `next/font/local` (latin variable subsets, weights 100–900, OFL 1.1), applied as CSS variables on `<html>`. The files are vendored because `next/font/google` downloads them at build time, which CI runners cannot reach. Body uses Geist Sans with `antialiased`. All metric values (traffic, rankings, CTR) displayed in Geist Mono for scan-readability.

---

### Border Radius

| Context | Class |
|---------|-------|
| Badges / inline | `rounded-lg` |
| Metric cards / panels | `rounded-2xl` |
| Modal / overlay | `rounded-3xl` |
| Buttons | `rounded-xl` |

---

### Dropdown / Menu Spacing

Account-style menus (`DropdownMenu*`) share one spacing rhythm — account block, then a separator, then actions:

```
DropdownMenuContent: w-60 (primitive default p-1)
├── DropdownMenuLabel: flex flex-col gap-1 px-1.5 py-1.5
│   ├── name:  text-sm font-medium text-foreground
│   └── email: text-xs font-normal text-muted-foreground
├── DropdownMenuSeparator
└── DropdownMenuItem: primitive default (px-1.5 py-1)
```

- Label horizontal padding matches item padding so the name/email align with the menu item icons.
- Always place a `DropdownMenuSeparator` between the account block and its action items — never let the header sit flush against the first item.
- Name and email are different sizes (`text-sm` / `text-xs`); never render both at one size.
- The rail's account menu is the one exception to `align="end"`: inside the phone drawer the trigger
  already sits at the viewport's right edge, so that menu uses `align="start" side="top"`. Keep the
  spacing rhythm; only the anchoring changes.

---

### Dashboard-Specific UI Patterns

#### Metric Cards

```
Card className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between"   (shadcn Card supplies surface + border)
├── Label: text-xs text-text-muted        (CardHeader, p-0)
├── Value: text-2xl font-mono font-medium tracking-tight text-text-primary
├── Delta: text-xs font-mono + state utility (↑ 4.2% / ↓ 1.8%)
└── Footnote: text-[11px] text-text-muted (CardFooter, p-0 border-none bg-transparent)
```

#### Trend Indicators

- Up: `text-state-success` · Down: `text-state-error` · Flat/absent: `text-text-muted`
- The arrow is a lucide icon (`ArrowUpRight` / `ArrowDownRight`, `size-3`, `aria-hidden="true"`) —
  never a raw `↑`/`↓` character. Direction and magnitude must also be in the text
  ("`{n} gained`" / "`{n} lost`" in the query table), because color and an aria-hidden glyph are
  invisible to screen readers.
- Never use raw green/red — always state tokens.

Utility names come from the `@theme inline` block in `globals.css` (`--color-state-success` →
`text-state-success`), **not** from the raw primitives. The primitive tables above are the values a
token resolves to; `text-success`, `bg-warning` and `text-neutral` are not utilities in this project
and silently produce no style. Check `app/globals.css` before inventing one.

#### Stale Data Banner

Rendered by `dashboard-hero.tsx` when `overview.staleSource` is true:

```
role="status" bg-state-warning/10 border border-state-warning text-state-warning
rounded-xl px-4 py-2 text-xs
"Data from {lastUpdated} — last sync failed. Showing cached results."
```

`staleSource` mirrors `current_metrics.is_stale`, which nothing writes yet, so this banner is
reachable in code but not in practice (see `docs/progress-tracker.md`).

#### Sync Status Pill

`dashboard-header.tsx`: a rounded-full chip with a pulsing `h-1.5 w-1.5` dot, hidden below `md`.

- Stale: `bg-state-warning/10 text-state-warning` + `bg-state-warning` dot
- Fresh: `bg-secondary text-primary` + `bg-primary` dot
- Label is `overview.syncStatus`, assembled in `lib/dashboard/overview.ts` — the component never
  computes freshness itself (invariant 9).

#### Keyword Rank Display

Today the query table renders rank as plain `#{rank}` in `font-mono font-medium`, with no
tier colouring; `--color-accent-primary-dim` and `--color-state-neutral` exist as tokens but no
component uses them yet. If rank tiers are ever introduced, keep them on the
`bg-state-*/10 + text-state-*` pair (10% tint + full-strength text) rather than adding new raw
colours, and note `--accent-primary-dim` is a red tint — it is the brand accent, not a "top 3" signal.

#### Loading Skeletons

- `DashboardSkeleton` (`components/features/dashboard/components/dashboard-skeleton.tsx`) is the `/dashboard` Suspense fallback and mirrors the real layout 1:1 — header, hero (domain line + h1 + range/tabs), 4 metric cards, 2/1 chart + brief grid, query table, AI grid, footer.
- Placeholder blocks use `bg-border/70` + `motion-safe:animate-pulse` (respects reduced motion); heights match the real content (`h-80` chart, `h-9` hero lines, matching card padding) so the early skeleton paint is the LCP candidate and no layout shift occurs when real data swaps in.
- Server component, no client JS. Root carries `aria-busy="true"`, `aria-live="polite"`, and an `sr-only` "Loading dashboard" label.

---

### Layout Patterns

- **Dashboard:** full-viewport, left destination rail (persistent and icon-collapsible on `md+`,
  an off-canvas drawer below), page header inside the content column, main content area.
  Authoritative shell spec: `specs/08-app-shell.md`.
- **Sidebar (`AppNav`):** the shadcn `Sidebar` primitive with `collapsible="icon"` — 15rem
  (`--sidebar-width` is overridden from the primitive's 16rem to keep the documented `w-60`)
  expanded, 3rem icons, `bg-sidebar border-r border-default`. Destinations come from
  `lib/navigation/destinations.ts`; the shell reads no session so `/dashboard` stays prerendered,
  and the account block fetches its own identity from `/api/auth/me`. Below 768px the same list
  renders in a `Sheet` drawer (18rem) opened by the hamburger in `MobileNav`, and every link
  closes it. The horizontal strip is gone.
- **Sidebar header / footer:** header is one row — the 2rem brand tile plus the wordmark on the
  left, `SidebarTrigger` on the right. The label carries `group-data-[collapsible=icon]:hidden`
  (8px padding either side of a 2rem tile is exactly the collapsed width, so the label hides rather
  than the row reflowing) and the row switches to `flex-col` when collapsed, because 2rem of
  content width fits one element per line. `SidebarTrigger` is `hidden md:flex`; below that
  breakpoint the trigger lives in `MobileNav`. Footer is `NavUser` alone.
  `NavUser` follows shadcn's nav-user anatomy with two deviations: three text lines — the role on
  top as its own span (`text-[10px] uppercase tracking-wide text-primary`, brand red, no chip),
  then the name, then the email at `text-xs` — so the `size="lg"` button carries
  `h-auto py-2` to escape the variant's fixed `h-12`; and the trailing affordance is
  `ChevronRight`, not `ChevronDown`, because the menu opens sideways off the rail edge. The
  `tooltip` carries the name so the collapsed rail still says who you are.
- **Admin panel:** `components/features/admin` inside the same shell; `/admin` is not a destination,
  so the rail renders beside it with no active row.
- **Modals:** centered overlay, `rounded-3xl`, `bg-elevated`, backdrop blur.
- **Dashboard header:** `bg-surface border-b border-default`, client selector + sync status +
  trigger sync + export menu + theme toggle. It no longer carries the account menu — that moved to
  the rail's footer. No brand mark: the rail owns it on `md+`, and `MobileNav` (sticky `h-12`,
  `bg-surface border-b border-default`, `md:hidden`) repeats the tile and wordmark below that, so
  `/connections` and `/profile` are branded at every width.
- **Data tables:** `bg-surface`, alternating `bg-subtle` rows, sticky header.

---

### Component Library

shadcn/ui on Tailwind 4. Components in `components/ui/`. Use `shadcn` CLI to add — never write from scratch. Override styles via token classes only.

### Toasts / Form Feedback

- `components/ui/toast.tsx` (Base UI Toast, added via shadcn) exposes `toast.add({ title, description, type })`; `Toaster` is mounted once in `app/layout.tsx`. The viewport is pinned bottom-right on `sm+` — it is the single feedback surface for form/action status.
- All form interactions run through one lifecycle (`lib/toast-status.ts`): `startStatusToast(title, description)` adds a persistent `"loading"` (spinner) toast; `finishStatusToast(id, { status, title, description, timeout })` flips it in place to `"success"` or `"error"`. Errors auto-dismiss in 8s, successes in 6s, and `timeout: 0` keeps important confirmations (e.g. "check your email") visible until dismissed.
- Copy pattern: titles `"Too many attempts"` / `"Could not complete"` / `"Sign out failed"` / `"Profile saved"` / `"Signed in"`; descriptions are generic user-safe messages.
- Rate limiting: every interactive submit path first checks a per-instance `SlidingWindowLimiter` (`lib/rate-limit.ts`). On rejection show the "Too many attempts" toast and skip the network call; the existing `pending`/`disabled` guard still blocks mid-flight re-submission.
- Submission controls keep their own pending affordance (button label swap + `aria-busy`) — the toast signals global status, the button signals local state.

---

### Motion

- Library: `motion` (Framer Motion), imported from `motion/react`, inside `"use client"` components only.
- Motion is deliberate, not decorative: at most one orchestrated reveal per view, triggered by scroll. Do not animate every section or card.
- Reveal-on-scroll uses the Fragment-Ref `InView` primitive (`components/ui/in-view.tsx`), not `motion`'s `whileInView`. The chart's decorative backdrop layers (offset `bg-secondary` panel + accent glow) were removed (2026-09-18); the only page motion is the `InView` card reveal gated by `useReducedMotion`.
- Always gate transforms and reveals with `useReducedMotion()` — when reduced, render the final state (no transforms, no opacity fade). `InView` consumers combine `revealed || shouldReduceMotion` and add `motion-reduce:transition-none`.
- Decorative layers (glows, backdrop panels) are `aria-hidden="true"` + `pointer-events-none` and never change layout.

#### View Transitions (React 19.3)

Dashboard section switches (Overview / Queries / AI Citation) use React's `<ViewTransition>` rather than `motion`:

- Tab panels stay mounted and are shown/hidden with `<Activity mode>` — panel state (e.g. the `QueryTable` filter) survives tab switches, and hidden panels do no background work.
- `<Activity>` nested inside `<ViewTransition>` triggers the enter/exit animation on visibility change.
- `addTransitionType("forward" | "backward")` (inside `startTransition`) selects the direction; classes live in `globals.css` as `vt-enter-forward` / `vt-enter-backward` / `vt-exit-forward` / `vt-exit-backward` / `vt-fade`.
- Panel content animates as a single wrapper element — do not wrap multiple sibling roots in one `<ViewTransition>`.
- All `::view-transition-*` animations are disabled under `prefers-reduced-motion: reduce`; no JS reduced-motion branch is needed for these.
- Keep this as the *one* navigational motion moment; do not also add `motion` transitions to the same panels.

### Landing Page (`/`, marketing) & Auth Pages

Landing palette — always dark, independent of `data-theme`. Active tokens: `landing-bg` `#050201`, `landing-surface` `#191c21`, `landing-surface-2` `#232830`, `landing-border` `#2a2f38`, landing text `#ffffff` / `#a6aeb8` / `#6e7682`, accent `#ea580c`, tints `#ff9e5e` (light orange), `#f2b88d` (warm), `#95a5b8` (neutral).

- Used solely on the landing page (hero glow, metric-card cards, icon chips); the app surfaces keep the structured tokens above.
- Entrance animations, uploadthing-style: `animate-landing-fade-in` (opacity), `animate-landing-fade-down` (opacity + −y), `animate-landing-scale-in` (opacity + scale) — gated `motion-safe:` so `prefers-reduced-motion` receives final state. Delays via inline `animation-delay` for the metric grid.
- Hero backdrop: two decorative `radial-gradient` glows (sky top-center, mint lower-left) — `aria-hidden` + `pointer-events-none`; layout unaffected.
- Two primary CTAs — `Get started` in the hero, `Get started free` in the trust band — both target `/auth/login`, never `/auth/sign-up`: the demo needs no account, and the login page's `DemoAccess` card opens a dashboard in one click. The hero carries a `text-landing-faint` line under the button saying so, in the same register as the "Sample figures" caption. No credential appears on the landing page: `/` is prerendered, so anything env-fed is baked at build time and simply absent in CI. `SiteHeader`/`SiteFooter` keep their own `Sign in` / `Sign up` text links, and `LandingFooter` closes the page.
- `SiteHeader` / `SiteFooter` (`components/features/landing/`) are shared page chrome with a `tone` prop: `"landing"` (landing palette) or `"default"` (app tokens). Auth pages wrap in `AuthPageShell` (header + centered `AuthCard` + footer, app tokens + full-height layout) — also on forgot/reset pages.
- Auth pages use one `AuthFlow` client component (`email-password-auth`): the sign-in and sign-up forms share a card and flip in place with a motion crossfade (`AnimatePresence mode="wait"`), fields stay email + password, `Continue with Google` / `Continue with Apple` (outline) sit below the divider under the fields — both render `disabled` with a “coming soon” caption while the providers are unconfigured (`SOCIAL_AUTH_READY` in `auth-flow.tsx`). Login/sign-up pages are chrome-less (`AuthPageShell chrome={false}`) — no site header/footer; a "Back to home" link (left, aligned with "Forgot your password?" on the right) heads back to `/`. Forgot/reset pages keep the header/footer chrome.

### Charts & Data Viz

- Library: Recharts (already in stack).
- Colors: always use CSS token vars — pass via `stroke={var(--accent-primary)}`.
- Grid lines: `--border-subtle` color, dashed.
- Tooltip: `bg-elevated border-default rounded-xl text-primary`.
- No chart titles — use card label above chart instead.
- Sparklines: single-color, no axes, no tooltip (overview only).

---

### Icons

Lucide React. Stroke-based only — no filled variants.

| Context | Size |
|---------|------|
| Inline / label | `h-4 w-4` |
| Buttons | `h-5 w-5` |
| Empty states | `h-8 w-8` |
| Trend arrows | `h-3 w-3` |

Trend direction is `ArrowUpRight` / `ArrowDownRight` — see § Trend Indicators. `TrendingUp` is a card and
section icon (`dashboard-metrics.tsx:28`, `landing-page.tsx:27`), never a direction glyph, and
`TrendingDown` is not used anywhere. Color via state tokens, not icon props.

## Code Standards

### General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component or route.
- Respect the system boundaries in § Architecture Context → System boundaries; a helper belongs in the layer that owns the data.
- One agent per file, and one file per concern — `lib/agents/authAgent.ts` is the template. Agents other than `authAgent` do not exist yet; when added they follow § TARGET STATE.
- Import within the app with the `@/` alias (`@/lib/db/repository`), never `../../..` climbing.
- Any module reading env secrets or the service-role client starts with `import "server-only"`.

### TypeScript

- Strict mode required throughout.
- No `any` — use explicit interfaces or narrowly scoped types.
- Validate all external input at the boundary before any logic runs (Zod). DB/JSONB payloads are
  external input too: `lib/db/repository.ts` parses rows through Zod instead of casting.
- Use `interface` for object contracts, `type` for unions/aliases.
- Contracts live in `types/`, not at the call site. `Source`, `NormalizedMetric`, `CurrentMetrics`,
  `Client` and `SyncLogInput` are in `types/metrics.ts`; `Database` in `types/database.ts` is
  handwritten — if you add a column, update it in the same change.

```ts
// ✅ the real stored shape: one JSONB array per (client, source) run
export type CurrentMetrics = {
  client_id: string;
  source: Source;               // "gsc" | "ga4" | "semrush"
  metrics: NormalizedMetric[];  // non-empty array, validated
  synced_at: string;
  is_stale: boolean;
};

// ❌ there is no per-metric row: no metric_type column, no single numeric value column
const row: any = await fetchGSC()
```

### Next.js

- Default to React Server Components.
- Add `"use client"` only for interactive UI: charts, date pickers, real-time stale banners, and auth forms.
- Route handlers do one thing: validate → authenticate → tenant-gate → read/delegate to `lib/*`.
  Never inline a query, and never re-implement the ownership rule (see invariant 4).
- Never run sync jobs inline in route handlers — always queue via BullMQ.
- Long-running work belongs in BullMQ jobs, not request handlers.
- Load heavy first-party chart libraries (recharts) via `next/dynamic` behind the nearest `<Suspense>`, and keep the Suspense fallback in its **own recharts-free module**. Never co-locate the fallback with the chart import — co-location defeats the split by pulling the chart barrel back into the initial route JS.
- Tree-shake first-party icon/chart barrel packages (`lucide-react`, `recharts`) via `experimental.optimizePackageImports` so the dashboard entry only ships the pieces the route actually uses.

### React 19.3 Rendering

- Opt a component out of SSR with `use(browser())` (`react-dom`) and wrap it in the nearest `<Suspense>` with a layout-matched fallback. Never hand-roll a `mounted` flag or `typeof window` check — `browser()` is the first-class API for this.
- Keep expensive offscreen subtrees mounted with `<Activity mode={open ? "visible" : "hidden"}>` so their state survives, instead of remounting. Do not use it to hide content that must re-initialize on show.
- Animate navigational changes with `<ViewTransition>` paired with `addTransitionType` so direction-aware enter/exit is possible. The state update must run inside `startTransition`, otherwise no animation is captured.
- `<Activity>` inside `<ViewTransition>` animates enter/exit on visibility changes while preserving state — this is the sanctioned pattern for tabbed/conditional panels.
- Define view-transition animations as CSS classes in `globals.css`, and disable all `::view-transition-*` animations under `prefers-reduced-motion: reduce`.
- Group wrapper-free DOM nodes with a Fragment Ref (`useRef<FragmentInstance>` + `<Fragment ref>`), not an extra `<div>`. `InView` (`components/ui/in-view.tsx`) uses this to observe its first-level children with one `IntersectionObserver` via `observeUsing` / `unobserveUsing`. Prefer it over `motion`'s `whileInView` for reveal-on-scroll; keep `motion` for scroll-linked values (`useScroll` / `useTransform`).
- Extract non-reactive callbacks out of effects with `useEffectEvent` instead of adding them to the dependency array. `InView` uses it so an inline `onChange` does not re-subscribe the observer.
- `next-themes@0.4.6` is patched via `pnpm.patchedDependencies` (`patches/next-themes@0.4.6.patch`) so its FOUC-prevention `<script>` is not re-rendered on the client. React 19 warns "Encountered a script tag while rendering React component" for the unpatched build. The patch early-returns `null` when `window` is defined; the script still ships in SSR HTML and runs before hydration. To change: re-run `pnpm patch next-themes@0.4.6` + `pnpm patch-commit`, never edit `node_modules` directly.
- **JSX trims the whitespace a newline leaves between an expression and the text after it**, so `{"1 account"}\n has signed up…` renders `1 account hassigned up…`. Build a mixed sentence as one template literal inside a single expression — `` {`${n} ${n === 1 ? "account has" : "accounts have"} signed up`} `` — and read the rendered copy in a browser before calling a pluralization branch done. Found in the admin attach dialog, where only the `n === 1` path was ever on screen.

### Security Headers

- `next.config.ts` owns the `Content-Security-Policy` (non-nonce) and applies it to every route; keep `proxy.ts` auth-only.
- Trusted Types are **not** enforced via `require-trusted-types-for` — the Next.js client router re-creates head `<script>`/`<link>` elements on route transitions and React DOM parses scripts through an HTML sink (`div.innerHTML = "<script></script>"`), so enforcing the directive blocks client-side navigation in production ("This document requires 'TrustedHTML'/'TrustedScriptURL' assignment"). Production and dev send only `trusted-types nextjs` on the enforced policy (defense in depth against injected `createPolicy` calls); dev additionally carries `require-trusted-types-for 'script'` on `Content-Security-Policy-Report-Only` for observability.
- `trusted-types` must list `nextjs` — the policy Next.js creates in `next/dist/client/trusted-types.js`.
- `connect-src` is dev-wide (`ws: wss: https:` plus `http://127.0.0.1:54321` / `http://localhost:54321`, which is how the `@auth` Playwright tier reaches a `supabase start` stack over plain HTTP) and production-scoped (`https://*.supabase.co wss://*.supabase.co`). Any new external origin (APIs, fonts, images) must be added to the matching directive in `next.config.ts`.

### Images

- Use `next/image` (`Image`) for every image project-wide. Never use a raw `<img>` element — the `@next/next/no-img-element` lint rule enforces this.
- For known-SVG sources, `next/image` automatically sets `unoptimized` (vector, lossless); this repo allows SVGs via `images.dangerouslyAllowSVG` in `next.config.ts`, paired with `contentDispositionType: "inline"` and a CSP that blocks embedded scripts (`default-src 'self'; script-src 'none'; sandbox;`). Only point this at self-authored, script-free SVGs (e.g. Archify exports).
- Always pass explicit `width`/`height` (the asset's natural dimensions) so Next can reserve layout space; pair with `sizes` or responsive classes (`h-auto w-full`) for fluid scaling.
- New external image origins must be added to `images.remotePatterns` in `next.config.ts` AND to `img-src` in the CSP.

### Styling

- Colour comes only from tokens declared in `app/globals.css`. No raw Tailwind palette classes
  (`zinc-*`, `slate-*`), no hex literals in JSX, no `style={{}}` colour overrides.
- Tailwind utilities are generated from the `@theme inline` block's `--color-*` names, so the
  utility is `--color-` stripped: `bg-surface`, `bg-elevated`, `text-text-primary`,
  `text-text-muted`, `border-border-default`, `text-state-success`, `bg-accent-primary-dim`.
  The raw primitives (`--bg-base`, `--text-primary`, `--accent-ai`) are **not** utilities —
  `bg-base`, `text-copy-primary`, `text-brand` generate nothing and fail silently.
  When unsure, `grep -- "--color-" app/globals.css`.
- Opacity modifiers on state tokens are the standard tint pattern: `bg-state-warning/10` +
  `text-state-warning`.
- Border radius comes from § Border Radius — do not invent a value. Metric cards are always
  `rounded-2xl`, and badges/inline stay on `rounded-lg` rather than the button value.

### API Routes

- On the tenant-scoped routes — the metrics pair and both export routes — parse the `{clientId}` path
  param with `z.uuid()` **before** anything else; a malformed id is 400, not 403 — never echo whether
  the id exists for an unauthenticated caller. The admin trio is the exception: `gateAdmin()` runs
  first, so 401/403 precede that family's 400.
- Order and status codes, on those same tenant-scoped routes: 400 malformed input → 401
  unauthenticated → 403 not this caller's client → 429 quota spent (exports, with `Retry-After`) →
  503 database failure; there is no 500 path and no 404 for another tenant's row. The admin trio
  instead maps Postgres codes via `lib/admin/errors.ts`: 409/403, 500 for `23514`, 502 for an unmapped
  code.
- On those routes only pure request validation (parsing the path id and the query) runs before a gate.
  The identity read and the tenant gate go through `lib/api/guard.ts` (`gateSession()` /
  `gateNullable()` / `gateClientAccess()` / `resolveAccessibleClient()` / `gateAdmin()`), each of
  which catches its own rejection and answers the JSON 503 — an outage or missing env config never
  yields an unhandled throw. The handler's `try` wraps the reads. A rejected read is a 503, not a 401:
  never turn infrastructure failure into "you are logged out".
- Routes build no JSON `Response` inline — `json`/`badRequest`/`unauthorized`/`forbidden`/
  `databaseFailure` are the only shapes a session-gated route may answer; the two bearer routes
  (`cron/sync`, `revalidate/dashboard`) sit outside the guard and build their own bodies. The two
  export attachments are the one exception inside the session-gated set: an inline `new Response` for
  the body, spreading the guard's `NO_STORE` for headers.
- Bodies: failures are always `{ error: string }` with a fixed, non-reflective message — echoing the
  request or a DB error into the body is a leak. Successes use **two** shapes today, so match the
  route you are extending rather than inventing a third: `/keywords` returns the `{ data, meta }`
  envelope, while `/dashboard/boot` and `/overview` return the composite resource directly
  (`{ profile, clients, selection }`, `{ overview, history }`). Unifying them is an open item, not a
  change to make while doing something else.
- Every session-gated response sends `Cache-Control: no-store` plus `Vary: Cookie` — the guard's
  `NO_STORE` pair; the two bearer routes are the deliberate exception, answering bare `Response.json`
  with no cache pair. No shared-cache freshness on a session-decided payload — `s-maxage` there is a
  lie while `Vary: Cookie` is present (Vercel refuses to cache it) and a leak the moment `Vary` is
  dropped.
- Keep handlers thin — push complexity into `lib/db`, `lib/dashboard`, `lib/exports`, `lib/queue`.
- Never return raw API credentials in any response.

```ts
// ✅ real handler shape from app/api/metrics/[clientId]/overview/route.ts
//    (Next 16 fork: ctx is typed and awaited. No route wires JSON + headers by hand —
//     lib/api/guard.ts's json() is that helper; bare Response.json() survives only on
//     the two bearer routes.)
const { clientId: rawClientId } = await ctx.params;
const clientId = clientIdSchema.safeParse(rawClientId);
if (!clientId.success) return badRequest("Invalid client id");

const session = await gateSession();          // null → 401, throw → 503
if (!session.allow) return session.response;

const access = await resolveAccessibleClient(clientId.data);  // RLS decides
if (!access.allow) return access.response;

try {
  const [overview, history] = await Promise.all([...]);
  return json({ overview, history }, 200);
} catch {
  return databaseFailure();                    // the one 503 sentence
}
```
`NO_STORE` is exported by `lib/api/guard.ts` — `{ "Cache-Control": "no-store", Vary: "Cookie" }`,
no `Content-Type` (the guard's `json()` adds that itself). `getAuthUser()` takes no request argument
— it reads the session from the cookie store; routes needing identity + role in one round trip use
`getAuthSession()`.

### Data & Storage

- All metric data in Supabase Postgres — no external blob storage.
- metrics_snapshots is append-only — never update or delete historical rows. `keyword_rankings`
  cascades from it, so a delete silently destroys keyword history too.
- current_metrics is the only mutable cache layer — one row per `(client_id, source)`.
- `api_credentials` holds a `vault:<uuid>` **reference**, never key material.
  `api_credentials_select_tenant_or_admin` lets a tenant (or an admin) select its own rows, and
  `20261010000000_credential_reference_unselectable.sql` narrows that role's `select` to the
  `client_id`, `source`, `created_at` columns (local stack only — hosted has not been told), so no
  code path can select `credential_reference` even by asking, and none does. Nothing in `.env`,
  logs, or responses may carry a provider key.
- Never expose the service-role key to client components or `NEXT_PUBLIC_*` vars. It is read only
  in `lib/db/admin.ts`, which is `server-only`.
- RLS enabled on every table — policies must match the role model (admin/client/staff), with
  role/client resolved by `security definer` helpers rather than parsed JWT claims.
- is_stale is computed server-side and stored — client reads the flag, never computes it.
- A new table ships with its policies in the same migration. "Table exists, RLS later" is a
  tenant-isolation bug, not a TODO.

### Standards for new agents

`lib/agents/` currently holds `authAgent` only. These rules apply to the sync/transform/cache/insights
agents when they are built to the contracts in § TARGET STATE.

- Each agent is a pure function where possible: input → output, side effects at the edges.
- Sync uses `Promise.allSettled` — one source's failure never blocks the others, and a partial
  success still writes what arrived.
- Transform validates with Zod per row and discards only the bad rows, logging the reason; it never
  aborts the whole run.
- Redis is for TTL/flags/circuit state, never for metric payloads — Postgres owns the data.
- Circuit-breaker state lives in Redis, not in process memory, so it survives restarts.

```ts
// ✅ partial failure safe
const [gsc, ga4, semrush] = await Promise.allSettled([
  syncGSC(creds),
  syncGA4(creds),
  syncSemrush(creds),
]);
// settle each independently; write what succeeded
```

### Error Handling

- Every awaited Supabase failure gets a JSON 503 — identity reads and tenant gates through the
  guard's per-gate `catch` (`lib/api/guard.ts`), reads through the handler's `try`. A thrown error in
  a handler becomes an HTML error page that the client `fetch` cannot parse.
- The dashboard has no cached-data fallback yet: a failed boot shows `"Failed to load dashboard
  data"` (`app/(app)/dashboard/dashboard-view.tsx`). Do not claim offline resilience until it exists.
- Sync failures (when built) write `sync_logs` → mark `is_stale` → alert admin. Agents never throw
  to a client.
- API errors logged with: clientId, source, timestamp, sanitized message. **No credentials, no
  tokens, no `console.log` of request headers.**
- Client-facing form/action status is a single bottom-right toast lifecycle (`@/lib/toast-status`): `startStatusToast` for processing → `finishStatusToast` flips to success/error. Do not build inline status banners — processing, success, and error all render in the toaster viewport.
- Interactive submit paths guard against duplicate submissions with a `SlidingWindowLimiter` (`lib/rate-limit.ts`) *and* the component's `pending`/`disabled` state — never rely on button disabling alone.
- A client-side mutation shows **the server's sentence, unchanged** (`components/features/admin/lib/mutations.ts` is the template): the component keeps no second copy of any error string and never paraphrases a code. A reply that is not JSON gets one fixed local fallback, so proxy HTML never becomes toast copy. Revalidate (`router.refresh()`) only on a 2xx — after a refusal the data already on screen is the correct data, and refreshing would be a cosmetic lie.
- Per-row commit-on-change controls (a `Select` or a button inside a table row) gate with a `busyId` on that row instead of a `SlidingWindowLimiter`: the in-flight write already disables its own control, and the limiter's spam case — a user hammering one submit — cannot occur. Two different rows writing concurrently is the intended behaviour.

### File Organization

```
lib/
  admin/        — provisioning schemas, Postgres error copy, definer-RPC caller (no React, no `cookies()`)
  agents/       — authAgent (identity + role). Other agents: not built
  api/          — `guard.ts`: the response shape and the session/admin/tenant gates for the 9 session-gated route files (the 2 bearer routes build their own bodies)
  auth/         — cron secret check, proxy routing decisions, safe `next`
  cache/        — tag ownership (`invalidate.ts`), worker→app ping (`notify.ts`)
  connections/  — `status.ts`: the pure join that backs `/connections`
  dashboard/    — read models shared by the boot and metrics routes
  db/           — repository (reads, tenant gate, writes) + `admin.ts` service-role client
  exports/      — dataset builder, CSV, PDF + `fonts/`, quota, filename
  navigation/   — `destinations.ts`: the rail's link list and `activeDestination()`
  queue/        — BullMQ queue definition + worker entrypoint
  rate-limit.ts — `SlidingWindowLimiter`
  supabase/     — client construction (protected)
components/
  ui/           — shadcn primitives (protected, do not hand-edit)
  features/     — app-shell, admin, connections, dashboard, data-export, email-password-auth, landing, user-profile
app/
  api/          — thin route handlers behind `lib/api/guard.ts` (11 files: 9 session-gated, 2 bearer; see § HTTP surface)
  (app)/        — route group, adds no URL segment: dashboard, connections, profile, admin
    dashboard/  — static shell + client-side boot fetch
types/          — shared contracts: metrics.ts, dashboard.ts, database.ts (handwritten)
supabase/
  migrations/   — append-only, timestamped; schema + RLS together
scripts/        — migrations runner, seed, demo user (the only way data lands today)
```

- Name files after responsibility, not technology.
- No business logic in `components/`.
- No DB calls in `app/api/` — delegate to `lib/db` / `lib/dashboard`.
- No sync logic in route handlers — delegate to `lib/queue`.
- Tests live in `tests/<feature>/<tier>/`; nothing is colocated beside the module it covers. Import
  the subject under test through `@/` — a relative `./` still resolves after the move, just possibly
  to a neighbouring file of the same name. `tests/helpers/` is the exception.

### Testing

See `/testing` for tiers, organization, mocking patterns and commands.

- Tests live in `tests/<feature>/<tier>/`, imported through `@/`, never relatively
- Mock at the boundary, unit tier only
- Every route test covers `401`/`403`/`400`/`503` and no-data-before-auth
- Opt-in tiers exit 0 — `pnpm test:integration` carries `--passWithNoTests` (`package.json:12`), so a
  green run can mean nothing matched. Report which tier a run covered
- Component-render tests are deliberately absent; a testing-library dependency is a decision to raise,
  not one to make silently (§2 of `docs/superpowers/specs/2026-09-23-test-suite-architecture-design.md`)

## Development Workflow — Portable core

1. Read what governs the change (§ STANDING RULES, then the context sections)
2. State scope in one sentence
3. Implement the smallest verifiable increment
4. Verify with commands, not claims
5. Update the docs the change made untrue
6. Report what changed, what was verified, what is unknown

### Scoping
- One feature unit or one agent at a time.
- Split when a step crosses boundaries: UI + sync agent, schema + API route, cache + auth,
  queue/cron + dashboard, or anything whose behavior is not written down.
- If end-to-end verification of a step is not quick, the scope is too broad — split it.
- A guessed constant, threshold, or policy is a requirement you invented. Label it or drop it.

### Verification
A unit is done when, in this order:
1. tests covering the changed paths pass (new behavior gets a new test in the same change);
2. typecheck passes;
3. lint passes;
4. the production build passes;
5. anything a test cannot reach (a page, a migration, a queue job) was exercised for real, and
   the observation is reported. "It should work" is not a status.

### Docs and truth
- Status docs record actual state, not intended state. Delete or re-mark an entry the moment its
  claim stops being true.
- Do not restate the spec in a doc — link it. Duplication is how docs go stale silently.

### Protected foundations
- Never patch a vendored component, framework file, or third-party internals to make a feature
  work. Project logic goes in project layers.
- If a foundation file seems to need editing, the real problem is upstream of it — say so instead
  of working around it.

### Git and review
- One logical change per commit; conventional prefix.
- Long-lived branch: pull/rebase the trunk before pushing; `--force-with-lease` only.

## Development Workflow — Project appendix

This appendix and § Development Workflow — Portable core both prescribe; where they disagree, this
appendix wins for this repo.

### Read order before implementing
§ STANDING RULES → § APPLICATION BUILDING CONTEXT.
Unbuilt design lives in § TARGET STATE; treat it as requirements, never as description.

### Commands
| Need | Command |
|------|---------|
| Dev server | `pnpm dev` |
| Tests | `pnpm test` (Vitest unit project) · `pnpm test:all` (+ integration) · `pnpm test:e2e` · narrow with `pnpm test <path>`, not `pnpm test -- <path>` |
| Types | `pnpm typecheck` (runs `next typegen` first) |
| Lint | `pnpm lint` |
| Build | `pnpm build` |
| Migrations | `pnpm db:migrate` |
| Seed demo data | `pnpm db:seed` |
| Seed connection placeholders | `pnpm db:seed-connections` — placeholder-only `api_credentials` rows (`vault:` reference, never a key), idempotent via `on conflict (client_id, source) do nothing`; needs the same `SUPABASE_DB_URL` redirection as `db:seed` |
| Demo user | `pnpm db:demo-user` |
| Queue worker | `pnpm worker` (manual only — no production host yet) |

`pnpm` only, Node ≥ 24 — § STANDING RULES 11 is the authority, including why `package-lock.json` was
deleted. npm/yarn produce a lockfile this repo does not use.

### Where logic goes
`lib/agents` identity/role only · `lib/db` persistence + the RLS-backed tenant gate ·
`lib/dashboard` read models shared by routes · `lib/connections` the connection-state join (derives
no ownership) · `lib/navigation` the rail's destination list · `lib/queue` queue + worker ·
`lib/cache` tag ownership · `lib/exports` CSV/PDF · `app/api` thin handlers.
Protected: `components/ui/*` (shadcn) and `lib/supabase/*` (client construction).

### Next.js 16 fork
This is not the Next you may remember. Read the matching guide in `node_modules/next/dist/docs/`
before touching a framework API: `proxy.ts` replaces `middleware.ts`, route handlers take a
`RouteContext<"/path">` second arg, `revalidateTag(tag, profile)` is two-argument, and
`next typegen` generates route types. Do not hand-write a `Middleware` export.

### Schema changes
Never edit an applied migration — add a timestamped one. Every new table needs RLS enabled with a
policy matching the role/tenant model in § Architecture Context, in the same change.

### Data today
The dashboard's rows come from `scripts/seed.mjs`, and the `api_credentials` rows `/connections`
renders from `scripts/seed-connections.mjs` — both are placeholders; nothing is fetched.
`pnpm worker` consumes the queue and returns `mock_completed`; it writes nothing. Anything you
observe about "sync" is therefore not evidence about sync.

### Agent development rules
- Build each agent in isolation before wiring it into the queue; mock the external API responses.
- Verify partial failure: kill one mock source, confirm the others still write.
- Verify the circuit breaker fires after 5 consecutive failures and that a paused client is alerted.
- Verify `is_stale` flips when a sync misses the 24-hour window — the banner depends on it.

### Before moving to the next unit
1. The unit works end to end inside the scope you stated in step 2 of the loop.
2. No invariant in § Architecture Context was violated (read the list; #4 tenant
   isolation and #12 the static dashboard shell are the ones that break silently).
3. `docs/progress-tracker.md` reflects what actually happened.
4. The four-gate chain in § STANDING RULES 13 is green — that rule is the authority on which gates,
   and it also names the integration and e2e tiers this checklist used to omit.
5. Nothing you started is still running — § STANDING RULES 5.

## PM Conventions

Tracked, reviewable work in this repo follows these conventions. Small tasks (< 15 lines of
real change) may be a single commit; anything larger is a PR.

### Commits

- Prefix with a conventional type: `feat:` `fix:` `style:` `perf:` `refactor:` `chore:`
  `docs:` `test:` `build:` `ci:`.
- No sweeping mixed commits ("misc cleanup + feature") — "one logical change per commit" is stated in
  § Development Workflow — Portable core.
- No co-authors, no "generated with", no body boilerplate.
- Never commit secrets / rotated tokens / real env values (gitignored, but check `git status`
  before `git add`).

### PRs

- Title: `<type>(<scope>): <imperative summary>` — e.g. `feat(auth): add staff role access`.
- Body: **what changed** (2-3 bullets), **how it was verified** (tests/typecheck/lint/build,
  plus any live check), and **what wasn't covered** (Vercel mirroring, live OAuth, etc.).
- One PR per feature/unit — follow the scoping rules in § STANDING RULES (standing constraints)
  and § Development Workflow. No grab-bag PRs.
- Draft until green; request review after the suite passes.
- Rebase-merge onto `main`; history is linear, so rebase before pushing.

**Skip when not needed:** tiny doc-only or rename-only changes don't need a PR; commit
directly to `main` with a conventional message.

# SERVICE ARCHITECTURE — implemented surface

This section describes only code that exists. Design intent for what is **not** built lives in
§ TARGET STATE; never cite that section as current behavior.

## Request path

```
proxy.ts (session refresh via updateSession)
  → app/api route handler
    → lib/api/guard.ts          — 401/403/503 shape + the gates, shared by the nine session-gated route files
    → lib/agents/authAgent      — identity + role
    → lib/db/repository         — RLS-backed tenant gate, then metric reads
  → components/features/*       — dashboard reads /api/dashboard/boot client-side
  → app/(app)/connections/page.tsx — server render; awaits listConnections() directly, no API hop
  → app/(app)/admin/page.tsx    — server render; requireAdmin() then getAdminView(), writes go over /api/admin/*
```

## Agents (`lib/agents/`)

| Module | Status |
| --- | --- |
| `authAgent.ts` | implemented: `getAuthSession()`, `getAuthUser()`, `requireAdmin()` |
| `syncAgent` / `transformAgent` / `cacheAgent` / `insightsAgent` | **do not exist** — spec only, see § TARGET STATE |

`authAgent` answers identity and role. It must not grow a copy of the client-ownership rule.

## Tenant isolation — one gate, enforced by RLS

- `canAccessClient(clientId)` and `listAccessibleClients()` in `lib/db/repository.ts` read the
  `clients` table through the per-request Supabase client (`createServerSupabaseClient()`:
  publishable key + session cookie), so Postgres decides visibility. Both fail closed.
- `listConnections()` composes those two reads for `/connections` (`clients`, then
  `api_credentials`) and adds no ownership rule of its own.
- No route or helper may re-implement "is this the caller's client?" in TypeScript.
- `lib/api/guard.ts` holds the response shape only — `NO_STORE`, `json`/`badRequest`/`unauthorized`/
  `forbidden`/`databaseFailure`, and the gates `gateNullable`/`gateSession`/`gateAdmin` (typed
  `Gate<null>`; `requireAdmin()` returns no user)/`gateClientAccess`/`resolveAccessibleClient` — and
  is a thin caller of the two RLS probes (`gateClientAccess` → `canAccessClient`,
  `resolveAccessibleClient` → `listAccessibleClients`); it owns no ownership rule. `lib/admin/http.ts`,
  which used to own the admin trio's shape, is deleted.
- Metric/keyword reads deliberately use the service-role client (`getAdminDb()`, RLS bypassed)
  because they run inside `unstable_cache`; they are reachable only with a `client_id` that already
  cleared the gate.
- Roles `admin | client | staff` come from the `users` row via `security definer` helpers
  (`private.current_user_role()`, `private.current_user_client_id()`) — never from JWT claims.
- Admin **writes** (`lib/admin/rpc.ts` → the five `public` definer RPCs) go through the user-scoped
  client, never table grants and never `getAdminDb()`: `admin_directory()` alone reads `auth.users`,
  and the role guard is the first statement in each function because a definer body bypasses RLS.
  Zero new table grants; `42501` from that guard is the enforcement point, and
  `pg_advisory_xact_lock(800100)` plus codes `45001`/`45002` are what make the last admin
  unremovable. `lib/admin/` has no React and no `cookies()` — the four verbs call it.

```ts
// lib/db/repository.ts — the gate
export async function canAccessClient(clientId: string): Promise<boolean> {
  const db = await createServerSupabaseClient();          // user-scoped: RLS applies
  const { data } = await db.from("clients").select("id")
    .eq("id", idSchema.parse(clientId)).eq("is_active", true).maybeSingle();
  return data !== null;                                   // no visible row == no access
}
```

Policies: `supabase/migrations/20260917000000_seo_poc.sql`,
`20260920000000_add_staff_role.sql`, `20260920000001_rls_hardening.sql`,
`20260925000000_connections_read.sql`, and `20261005000000_admin_provisioning.sql`, whose five `public`
`security definer` functions were applied to the local stack 2026-10-05 **and** to the hosted project
2026-10-08, where an anonymous `POST /rest/v1/rpc/admin_directory` answers `42501` from the grant layer
(no `EXECUTE` to `anon`) before any function body runs. `api_credentials` is readable through
`api_credentials_select_tenant_or_admin`, which applies the same two `security definer` helpers as
`clients`; that policy is **row-level**, so it decides which rows a caller sees and never which
columns. The column question is answered by grants, **on the migrated local stack**: `authenticated`
holds no table-wide `select` on this table —
`20261010000000_credential_reference_unselectable.sql` revoked it and granted `select` back on
`client_id`, `source` and `created_at` only, which is exactly what the app reads and what
`listConnections()` names. A live tenant session that asks for `credential_reference` by name gets
`42501 permission denied for table api_credentials`, with no PostgREST schema-cache reload — that
SQLSTATE is asserted by the negative case in
`tests/tenant-isolation/integration/credentials-visibility.test.ts`, not merely quoted. `id` is
ungranted too (no caller reads it), and `select *` is refused for the same reason: Postgres does not
silently shrink `*` to the granted columns here (checked directly with
`set role authenticated; select * from public.api_credentials` → `42501`).
After the narrowing there is **no** `authenticated` entry in `pg_class.relacl` — the grants live in
`pg_attribute.attacl`, so `aclexplode(relacl)` prints zero rows on a correctly migrated database and
`has_column_privilege` / `information_schema.column_privileges` are the audit tools.
`20260925000000_connections_read.sql` is applied to the local stack **and** to the hosted project
(2026-09-30), so `/connections` serves a signed-in user on hosted and the only `api_credentials`
rows there are the seeded placeholders; the narrowing migration above is applied **to the local
stack only** — hosted still grants table-wide `select` to `authenticated` until that apply gets its
own yes. The accepted limitation both this file and `specs/09-connections.md` used
to record (row-level policy → the reference column-selectable) is closed; it was acceptable while it
stood because the column holds an opaque Vault reference, not key material, and nothing in the app
decrypts it.

These policies have been exercised against a live Postgres (local `supabase start` stack) by
`tests/tenant-isolation/integration/rls-gate.test.ts` and
`tests/tenant-isolation/integration/credentials-visibility.test.ts` — client/staff/admin/anon
visibility for `clients` and for `api_credentials`, including the denial above for the reference
column, proven at the database and not only through a faked PostgREST.

## HTTP surface (what actually exists)

Ten handlers in nine session-gated route files (`find app/api -name route.ts` → 11 files; the two
bearer routes are the exception) share one response-shape and gate module, `lib/api/guard.ts` — see
Tenant isolation above.

The tenant-scoped ones — the metrics pair and both export routes: validate the `{clientId}` path param → resolve identity → pass the RLS-backed tenant gate → read or delegate. Their precedence is 400 malformed id → 401 unauthenticated → 403 not this caller's client → 503 database failure; the two export routes add 429 (`Retry-After`) once the sliding-window quota is spent. The 401/403/503 decisions and their bodies come from the guard, which returns either the value the route needs or a finished `Response` — ordering stays in the handler, and only path/query validation runs before a gate. A rejected identity or gate read is a 503 with `{ error: "Database operation failed" }`, never a 401. Tenant gates go through `listAccessibleClients()` / `canAccessClient()`, never a TypeScript re-derivation: the guard forwards to those two and owns no ownership rule of its own. The gate's own denials are one sentence per status — 401 `Unauthorized` on every session-gated route since 2026-10-11, which replaced `"Forbidden"` on the metrics and export 401 path — while a body a route authors itself varies: `badRequest` messages name the input, and the PDF route's render failure answers 503 `"Report rendering failed"`. The two bearer routes (`cron/sync`, `revalidate/dashboard`) are the deliberate exception: no session, so `verifyCronSecret` and their own bodies.

The three `/api/admin/*` handlers (`lib/api/guard.ts` owns their shape) replace that order with
`gateAdmin()` → path-param uuid → body → zod → `callAdminRpc` → code→status, so the role guard and
validation run **before any table is touched**; their *Postgres* error bodies come only from
`lib/admin/errors.ts`, the gate's own denials and its read-failure 503 come from
`lib/api/guard.ts`, and no sqlstate code reaches the gate. They are writes, so they do not use
`databaseOperation()` — that wrapper erases the Postgres `code`, which is the whole payload of the
error map.

| Route | Method | Auth | Notes |
| --- | --- | --- | --- |
| `/api/auth/me` | GET | session | `ProfileView` for the rail's account block; 401 with no session, 503 on a read failure, `no-store` + `Vary: Cookie` via `NO_STORE`. Exists because the shell stays session-free, so identity has to arrive over the wire |
| `/api/dashboard/boot` | GET | session | one payload for the whole dashboard boot: profile + accessible clients + selection |
| `/api/metrics/[clientId]/overview` | GET | session + gate | `?days=` (default 7), `unstable_cache` |
| `/api/metrics/[clientId]/keywords` | GET | session + gate | `?source=gsc\|ga4\|semrush`, rank history |
| `/api/exports/[clientId]/csv` | GET | session + gate | streams via `lib/exports/server.ts`, attachment headers spread `NO_STORE` |
| `/api/exports/[clientId]/pdf` | GET | session + gate | pdf-lib + vendored Noto Sans TTFs, attachment headers spread `NO_STORE` |
| `/connections` (page) | GET | session + RLS | server page; reads `api_credentials` per tenant, no cache |
| `/admin` (page) | GET | session + `requireAdmin()` | server page in the `app/(app)/` group; renders clients + members; redirects a non-admin to `/dashboard` |
| `/api/admin/clients` | POST | session + `requireAdmin()` | `admin_create_client()` definer RPC; user-scoped client |
| `/api/admin/clients/[clientId]` | PATCH | session + `requireAdmin()` | `admin_update_client()`; name and/or `is_active`, never domain |
| `/api/admin/members/[userId]` | PUT / DELETE | session + `requireAdmin()` | `admin_attach_member()` / `admin_detach_member()`; the last admin cannot be removed |
| `/api/revalidate/dashboard` | POST | `CRON_SECRET` bearer | the only path that revalidates `DASHBOARD_OVERVIEW_TAG` |
| `/api/cron/sync` | GET | `CRON_SECRET` bearer | enqueues one job per active client; Vercel cron `0 2 * * *` |

Per-route contracts — the detail behind the table's Notes column:

- `GET /api/dashboard/boot` — the dashboard's single boot request: `{ profile, clients, selection: { clientId, days, payload: { overview, history } } }` for the URL's `?client=&days=`, falling back to the first accessible client and `DASHBOARD_RANGES[0]`. `no-store` + `Vary: Cookie`.
- `GET /api/metrics/{clientId}/overview` — `{ overview, history }` from `current_metrics` + `keyword_rankings` via `unstable_cache`; `?days=` must be a `DASHBOARD_RANGES` member or it silently falls back to the default. `no-store` + `Vary: Cookie`.
- `GET /api/metrics/{clientId}/keywords` — returns the raw rows, not series, as the `{ data, meta }` envelope; the grouping into `KeywordRankSeries` is `buildKeywordSeries`, reached through `getKeywordRankingHistory` on the dashboard read path, not by this route. `?source=` (`gsc` default) + `?from`/`?to` ISO (default: last 30 days). Same `no-store` + `Vary: Cookie`.
- `GET /api/exports/{clientId}/csv` — `text/csv; charset=utf-8` attachment. Filename is ASCII-slugged (`<client-slug>-metrics-<days>d-<YYYY-MM-DD>.csv`) by `lib/exports/filename.ts`, so non-ASCII client names never reach the header.
- `GET /api/exports/{clientId}/pdf` — `application/pdf` attachment, same filename scheme with `-report-`. 503 JSON when `renderPdfReport()` throws — never a 200 with an empty body.
- `POST /api/revalidate/dashboard` — `revalidateTag(DASHBOARD_OVERVIEW_TAG, DASHBOARD_REVALIDATE_PROFILE)` (the profile is `{ expire: 0 }`, both constants owned by `lib/cache/invalidate.ts`), guarded by `Authorization: Bearer <CRON_SECRET>`. `revalidateTag` throws outside a request context, which is why the standalone worker POSTs here (`lib/cache/notify.ts`) instead of calling it.
- `GET /api/cron/sync` — Vercel cron (`vercel.json`, `GET`, bearer `CRON_SECRET`): iterates `listActiveClients()` and queues one BullMQ job per client with `Promise.allSettled`; returns `{ queued, errors }`. Jobs are consumed by `lib/queue/worker.ts`, which currently returns `mock_completed` without touching the sources.

Planned and absent: see § TARGET STATE → Planned API Route Definitions, whose `### Cron Trigger` is the
one route there that exists — it ships as `GET /api/cron/sync`, described just above.

## Queue, worker, cron

- `lib/queue/syncQueue.ts` — BullMQ on Upstash Redis, queue name `seo-sync`, zod-guarded job body.
- `lib/queue/worker.ts` — `pnpm worker` runs it locally. It currently revalidates the dashboard and
  returns `status: "mock_completed"`: no API fetch, no rows written.
- **Nothing consumes the queue in production.** Vercel hosts only the cron; hosting the worker
  (always-on process, inline-in-cron, or QStash) is an open decision — see § Open product questions.
- `persistMetrics`, `markMetricsStale` and `writeSyncLog` in `lib/db/repository.ts` exist but have
  zero callers. All dashboard rows today come from `scripts/seed.mjs`, and the placeholder
  `api_credentials` rows `/connections` renders come from `scripts/seed-connections.mjs`.

## Pages and caching

`app/` routes: `/` (landing), `/auth/{login,sign-up,forgot-password,reset-password}`, `/privacy`,
`/terms`, plus `app/auth/callback/route.ts` (PKCE exchange). `/dashboard`, `/profile`,
`/connections` and `/admin` live in the `app/(app)/` route group — the group folder adds no URL
segment — under one server-component shell (`app/(app)/layout.tsx` →
`components/features/app-shell`): a `collapsible="icon"` rail on `md+` (15rem ↔ 3rem, preference in
`localStorage`, not the primitive's cookie) and a `Sheet` drawer below it opened from a `md:hidden`
top bar that also carries the brand mark. Rail links come from `lib/navigation/destinations.ts` and
close the drawer on click; the rail's footer holds `NavUser`, the only piece of identity in the
shell, which fetches `/api/auth/me` after hydration. The shell itself reads no session, no cookie,
so it cannot make a page dynamic — which is also why `/api/auth/me` exists. `/admin` is not a
destination: `activeDestination("/admin")` is `null`, the rail renders its two links with none active,
and the entry is the role-gated Admin item in `NavUser`. `/profile` is in the same state — its rail
row was deleted as a duplicate of that block, which carries Profile and Edit profile. Because
`NavUser` sits in the shell and
not in the dashboard header, the admin door is now open on the `EmptyShell` states too — the gap
`specs/07-admin.md` tracked is closed, and `AccountMenu` is deleted.
No `sitemap.ts`/`robots.ts`, and no LLM/Claude dependency.

`lib/cache/invalidate.ts` owns `DASHBOARD_OVERVIEW_TAG = "dashboard-overview"`; revalidation happens
only through `POST /api/revalidate/dashboard` (`revalidateTag(tag, profile)`), never from the worker.
`/dashboard` stays a prerendered static shell (`○`). `/connections` is dynamic (`ƒ`) and declares
`export const dynamic = "force-dynamic"`, which is load-bearing rather than decorative: the page
awaits the cookie-bound read, and `databaseOperation()`'s catch-all converts Next's prerender bailout
into `Error("Database operation failed")`, so without the declaration `pnpm build` fails. The
underlying defect in the shared `lib/db` error wrapper stays open deliberately, for a later change.
`/admin` carries the same declaration for the same reason — `getAdminView()` is cookie-bound — so it
builds as `ƒ` while `/dashboard` remains `○`: the shell still reads no session, which is exactly why
the rail cannot mark a row active on an admin page. The panel's writes are client-side `fetch` calls
to `/api/admin/*` followed by `router.refresh()`, and the refresh runs only on a 2xx. Those routes'
denials, 503s and success envelopes (`json({ client })` / `json({ member })`) come from
`lib/api/guard.ts` (`lib/admin/http.ts` is deleted); the two export routes are the place a
session-gated handler still builds its own success `Response`, taking only the `NO_STORE` headers from
the guard.
`is_stale` is a stored column the UI only reads — `markMetricsStale()` exists but nothing calls it,
so the stale banner can never fire yet.

Cache-bound invariant (both metrics routes): client `CACHE_TTL_MS` == `unstable_cache revalidate` == **300s**, and the response is `no-store` — the CDN is not one of the layers. It never was: `public, s-maxage=300` was sent until 2026-10-10, but Vary cannot carry `Cookie` on Vercel ("Vercel's CDN doesn't cache a response whose `Vary` names … `Cookie`", reason `vary_key_denied:cookie`, [changelog 2026-09-30](https://vercel.com/changelog/vary-cookie-responses-no-longer-cached)), so every request was a MISS and the recorded three-way bound was fiction. The header was also the wrong safety device: with `s-maxage` present and `Vary` dropped by a later edit, per-tenant data becomes URL-keyed edge cache and the RLS gate is skipped on the hit. Both route unit tests now assert the absence of `public`/`s-maxage`/`stale-while-revalidate`, so that is pinned by a test rather than by a caching header. (A 2026-09-21 revert to 60s, `58599ac`, no rationale recorded, was resolved to 300 on 2026-09-24; that bound survives unchanged.) `NO_STORE` in `lib/api/guard.ts` is that constant — `no-store` + `Vary: Cookie`, deliberately a spreadable header object, not a `Headers`; `json()` adds the `Content-Type`, and the two attachment responses spread it and add their own `Content-Type` / `Content-Disposition`.

## Verification

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # the gate
pnpm test:all                                            # + integration tier — needs the local stack: `pnpm exec supabase start` and a filled `.env.test`
pnpm test:e2e                                            # public Playwright specs
```

The two live-RLS files — `tests/tenant-isolation/integration/rls-gate.test.ts` (`clients`) and
`credentials-visibility.test.ts` (`api_credentials`) — are the only evidence that the RLS policies
actually decide visibility; the integration tier's third file,
`tests/admin/integration/provisioning.test.ts`, proves the admin `security definer` RPCs, not
visibility. All three `skipIf` on `TEST_SUPABASE_URL`, so the tier skips with a warning
rather than faking a pass when `.env.test` has no `TEST_*` names.
`supabase/config.toml` keeps `[db.migrations].enabled = false` —
`pnpm db:migrate` is the sole applier and ledger (`public.schema_migrations`); the CLI's own
boot-time apply collides with it.

`.github/workflows/ci.yml` runs those four plus the public e2e tier on every push to `main`/`dev`
and on pull requests, with non-secret Supabase env placeholders so the build can prerender and the
guard/landing specs can serve without a database. Tests live in `tests/<feature>/<tier>/`
(`unit`, `integration`, `e2e`), never beside the module; mock at module boundaries, never inside
business logic.

| test folder | owns |
| --- | --- |
| `identity` | `lib/agents/authAgent`, `lib/auth/{cron,routing}`, `lib/supabase/*`, `proxy.ts`, the `/auth/*` pages, `components/features/{user-profile,email-password-auth}/lib`, `/api/auth/me`, and the rail's account block (`components/features/app-shell/components/nav-user.tsx`) — the invariant it protects is identity and sign-out, not rail chrome |
| `tenant-isolation` | `canAccessClient` / `listAccessibleClients`, `listConnections` + `lib/connections/status`, and the RLS policies behind all three |
| `dashboard` | `/api/dashboard/boot`, both `/api/metrics/*` routes, `lib/dashboard/*`, `lib/cache/*` tag ownership, `/dashboard` and the `app/(app)/` shell it shares: the rail, its collapse/drawer behaviour and `MobileNav` (`tests/dashboard/e2e/rail.spec.ts`) |
| `export` | `/api/exports/[clientId]/{csv,pdf}`, `lib/exports/*`, the export menu |
| `admin` | `lib/admin/*`, `components/features/admin`, the three `/api/admin/*` routes, `app/(app)/admin/`, and `tests/admin/integration/provisioning.test.ts` — the anonymous `/admin` redirect spec is the one exception: `tests/identity/e2e/admin-guard.spec.ts` sits in `identity` because the rule it protects is `lib/auth/routing`'s |
| `sync` | `/api/cron/sync`, `/api/revalidate/dashboard`, `lib/queue/*` |
| `landing` | `/`, `/privacy`, `/terms`, `components/features/landing/*` |
| `platform` | cross-cutting primitives with no owning feature — `lib/api/guard.ts`, `lib/rate-limit.ts`, `lib/navigation/destinations.ts`, the connections catalog |

A test goes in the feature that owns the *invariant the test protects*, not the file it imports.
`lib/rate-limit.ts` has consumers in three features, so it belongs to none of them.

## Repo skills

Two loader directories. `.claude/skills/` and `.agents/skills/` are reachable from different agents,
and which one holds a skill's bytes is per entry, not a repo-wide rule.

Skills that exist and when to load them:

- `babysitting-a-pr` + `leaving-pr-comment` — how PR review bots, comments and checks get handled
  and worded. Also installed user-level, so they apply to every repo.
- Process: `development-workflow` (the per-unit loop), `verification-gates` (the gate chain and how
  to report each run), `testing` (tiers, organization, mocking boundaries, route coverage),
  `git-workflow` (commits, push discipline, PR shape). Each closes by naming the section it
  implements; that section, not the skill, is the contract.
- Stack: `code-review`, `feature-component`, `frontend-design`, `shadcn`, `supabase`,
  `supabase-postgres-best-practices`, `tailwind-design-system`, `motion-design`, `playwright-cli`,
  `migrate-radix-to-base`.
- Visual direction: `gpt-taste` only. The other nine below are listed because `.claude/skills/`
  names them; none resolves — see the dangling entries immediately after.

The mirror, measured 2026-10-13 with `readlink` and `-L`. It is **neither one mechanism nor one
direction**, and there are **no hardlinks** — an inode match in `ls -i` printed above a linked name
is one file reached twice, not two links to it:

- `.agents/skills/` carries 17 entries and holds the real content for **12**. Five are symlinks
  (`git ls-files -s` mode `120000`) into `.claude/skills/`: `feature-component` and the four process
  skills above.
- `.claude/skills/` carries 26 entries: **18 symlinks into `.agents/skills/`** and **8** real
  directories. So for those 18 the source of truth is `.agents/skills/`, and only `feature-component`
  plus those four are authored in `.claude/skills/` — the opposite of "edit `.claude/`, the mirror
  follows".
- `babysitting-a-pr`, `leaving-pr-comment` and `playwright-cli` are the exception: each is a real
  directory in **both** trees, byte-identical today (`diff -rq` clean). Nothing propagates between
  the pair, so editing one silently un-pairs them.
- **9 of the 18 `.claude/` symlinks are dangling** — `brandkit`, `design-taste-frontend`,
  `high-end-visual-design`, `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web`,
  `minimalist-ui`, `redesign-existing-projects`, `stitch-design-taste` all point at `.agents/skills/`
  entries that do not exist, and are committed as links. `.claude/skills/` therefore advertises nine
  skills no loader can read. Closing that gap means authoring or vendoring nine skills, not editing
  this file, so it stays open as the owner's call.

Check the counterpart before editing it — `[ -L path ]` separates a link from a directory, and
`git ls-files -s path` prints `120000` for a committed link. `git add` refuses a path that resolves
*through* a link (`fatal: pathspec '…' is beyond a symbolic link`, exit `128`), so stage the real
directory: `.agents/skills/<name>/` for the **nine** of those 18 that resolve — the other nine are
links to nothing, so there is no file to stage for them anywhere — and `.claude/skills/<name>/` for
the five that go the other way. `.opencode/` carries only
`commands/feature-component.md` — its own `.gitignore` keeps the tool's `node_modules/` and
`package.json` untracked, so do not expect skills there.

# FEATURE SPECS

Feature specifications live in `specs/`, one file per deliverable unit, numbered in implementation
order; `specs/00-template.md` is the skeleton. `docs/superpowers/specs/` holds dated design docs
instead — a spec states requirements for one unit, a design doc records one decision.

# TARGET STATE

Design intent for what is **not** built. Most of this section is requirements rather than description: treat it as
requirements, and give each item its own build + test pass before citing it as fact. Where a promise
below is already built — § Product features the spec promises and § Build sequence (original POC plan)
both mix shipped and unshipped halves — § Project Overview → Status is the authority. Two further things
in this section look like current state and are not authority either: the verified-status block below,
which is the older record (2026-09-23, corrected 2026-09-25) and is subordinate to § Status wherever
they disagree; and the `POST /api/cron/sync` shape, which ships as `GET /api/cron/sync` — § HTTP surface
is its authority.

Verified status at 2026-09-23, corrected where a bullet says otherwise:
- `lib/agents/` contains `authAgent.ts` only. `syncAgent`, `transformAgent`, `cacheAgent`,
  `insightsAgent` do not exist.
- `lib/queue/worker.ts` consumes `seo-sync` and returns `status: "mock_completed"` — it performs no
  external fetch and writes no rows.
- `persistMetrics`, `markMetricsStale` and `writeSyncLog` in `lib/db/repository.ts` have zero
  callers; dashboard data currently comes from `scripts/seed.mjs`.
- **Corrected 2026-09-25:** `api_credentials` **is** now read by the app. `listConnections()`
  selects `client_id, source, created_at` through the tenant-scoped
  `api_credentials_select_tenant_or_admin` policy and `/connections` renders it. What is still not
  built is the rest of this section: nothing selects or resolves `credential_reference`, and no source
  is ever fetched.
- No deployment host runs the worker. Vercel provides only the cron (`vercel.json`: `0 2 * * *` →
  `GET /api/cron/sync`), so enqueued jobs have no consumer in production.

Routes below marked "planned" are absent from `app/api/`. Read § SERVICE ARCHITECTURE for what the app
actually serves.

## Product features the spec promises

### Authentication & Access Control

- Google OAuth and email/password via Supabase Auth, with email confirmation and password recovery.
- Route protection: clients see only own data (RLS at DB layer).
- Roles: admin (full access) | client (own data only) | staff (assigned clients).

### Multi-Client Dashboard

- Per-client dashboard: organic traffic, conversions, clicks, impressions, CTR, avg position.
- Keyword rankings: top 3/10/20, biggest movers (up/down).
- Landing page performance, backlinks summary, SEO visibility score.
- Month-on-month + custom date range comparisons.
- Last updated timestamp + stale-data warning banner.

### Automated Data Sync

- Automated daily syncing of every active client from Google Search Console, GA4 and Semrush/Ahrefs.
- Schedule, the parallel-source mechanics, the retry/backoff and circuit-breaker values — including the
  admin alert on a paused client — and the sync-log fields are stated under § Planned agents →
  1. API Sync Agent and § Error Handling Per Agent.

### AI Performance Insights

- Plain-English performance summaries per client, generated by the Claude API.
- Input window, model, output shape and cache policy are stated under
  § Planned agents → 5. AI Insights Agent.

### Admin Panel

- Add/manage clients and API credentials (stored in Supabase Vault).
- View sync logs and failure alerts per client.
- Manual sync trigger per client.
- Activate/deactivate clients.

### Data Export

- CSV export of historical metrics.
- PDF report generation (per client, per date range).

---

## Planned agents

### 1. API Sync Agent (`lib/agents/syncAgent.ts`)
**Responsibility:** Daily data retrieval from all sources
- Pulls from: GSC, GA4, SEO platform APIs (Semrush/Ahrefs)
- Runs: 2 AM daily via BullMQ queue (triggered by Vercel cron)
- Handles: OAuth token refresh, retry logic, partial failures
- Input: clientId, API credentials from Supabase Vault
- Output: appended metrics_snapshots rows + updated current_metrics cache

**Tech Stack:**
- BullMQ queue (replaces Bull, Redis-backed)
- Upstash Redis for queue storage
- Promise.allSettled for parallel API calls (partial failure safe)
- Exponential backoff retry (3 attempts per source: 1s → 4s → 16s)
- Circuit breaker after 5 consecutive failures per client, pause sync + alert admin

**Implementation:**
```ts
// lib/agents/syncAgent.ts
export async function syncClient(clientId: string) {
  try {
    const creds = await getClientCredentials(clientId) // Supabase Vault
    const [gsc, ga4, semrush] = await Promise.allSettled([
      syncGSC(creds.gsc_token),
      syncGA4(creds.ga4_token),
      syncSemrush(creds.semrush_api_key)
    ])
    // handle each result independently
    const normalized = await transformData(gsc, ga4, semrush)
    await insertSnapshots(clientId, normalized)
    await updateCurrentMetrics(clientId, normalized)
    await logSync(clientId, 'success', records.length)
  } catch (error) {
    await handleSyncFailure(clientId, error)
  }
}
```

**Credential-resolution constraint (added 2026-10-12).** The worker resolves a credential reference through a
**service-role read** or a **`security definer` function** — never through a tenant-visible `select`.
`20261010000000_credential_reference_unselectable.sql` revoked `authenticated`'s table-wide `select`
on `public.api_credentials` and granted it back on `client_id`, `source`, `created_at` only, so
`credential_reference` (and `id`) are unreadable to the `authenticated` role, and
`getClientCredentials()` above cannot be implemented as a `select` made with the caller's session.
Which databases that narrowing has actually been applied to is current state and lives in
§ Tenant isolation, not here — this section holds design intent only, and one of its own claims is that
`credential_reference` is never resolved through a tenant-visible read. The constraint does not depend
on which database you are in, and neither reading should be chosen because the column happens to be
readable today. A worker reading the reference *as the caller* would undo the narrowing and put
tenant-facing code on the credential path at the same time.
The service-role option is the one `getAdminDb()` already exists for; the definer option keeps the
read inside a role guard, the pattern the admin RPCs use.

---

### 2. Data Transform Agent (`lib/agents/transformAgent.ts`)
**Responsibility:** Normalize API responses into dashboard schema
- Input: Raw API data from GSC, GA4, Semrush (varies by source)
- Transform: Standardize to MetricSnapshot interface
- Validate: Zod schema validation, log errors separately
- Output: Normalized array of snapshots + current_metrics updates

**Tech Stack:**
- Zod for schema validation (typed, strict)
- TypeScript interfaces: MetricSnapshot, KeywordRanking
- Separate error logging (log transformation failure, don't block sync)

**Implementation:**
```ts
// lib/agents/transformAgent.ts
import { z } from 'zod'

const MetricSnapshotSchema = z.object({
  clientId: z.string().uuid(),
  date: z.string(),
  platform: z.enum(['gsc', 'ga4', 'semrush']),
  metricType: z.enum(['organic_traffic', 'conversions', 'clicks', 'impressions', 'ctr', 'position']),
  value: z.number(),
  metadata: z.record(z.unknown()).optional(),
})

export async function transformData(gsc, ga4, semrush) {
  const snapshots = []
  try {
    snapshots.push(...transformGSC(gsc))
    snapshots.push(...transformGA4(ga4))
    snapshots.push(...transformSemrush(semrush))
  } catch (err) {
    logTransformError(err)
  }
  return snapshots.map(s => MetricSnapshotSchema.parse(s))
}
```

---

### 3. Cache/Freshness Agent (`lib/agents/cacheAgent.ts`)
**Responsibility:** Manage stale-data flags & fallbacks
- Monitors: Last sync time per client per source (Upstash Redis TTL)
- Flags: is_stale = true if sync missed > 24hrs
- Fallback: Serves cached data from current_metrics + warning banner
- Cleanup: old snapshots archived weekly (separate job)

**Tech Stack:**
- Upstash Redis for TTL management (key: `stale:{clientId}:{platform}`)
- Supabase current_metrics table stores is_stale flag
- Dashboard reads is_stale from DB (client never computes staleness)

**Implementation:**
```ts
// lib/agents/cacheAgent.ts
export async function markStale(clientId: string, platform: string) {
  const key = `stale:${clientId}:${platform}`
  await redis.setex(key, 86400, '1') // 24hr TTL
  await supabase
    .from('current_metrics')
    .update({ is_stale: true })
    .eq('client_id', clientId)
    .eq('platform', platform)
}

export async function checkStale(clientId: string, platform: string) {
  const key = `stale:${clientId}:${platform}`
  return !!(await redis.exists(key))
}
```

---


### 5. AI Insights Agent (`lib/agents/insightsAgent.ts`)
**Responsibility:** AI-powered insight summaries
- Runs: inline Claude API call, on demand when the user asks for insights — not a BullMQ job
- Input: current_metrics + last 30-day metrics_snapshots for client
- Claude API call: summarize ranking changes, top gains/losses, focus areas
- Output: plain-English insights cached in current_metrics as `ai_summary` metric
- Cache: cached 24hrs (don't regenerate every request, cost control)

**Tech Stack:**
- Claude API (claude-sonnet-4-6 model)
- Prompt template per insight type (ranking summary, traffic analysis, etc.)
- Upstash Redis cache for response

**Implementation:**
```ts
// lib/agents/insightsAgent.ts
export async function generateInsights(clientId: string) {
  const cacheKey = `insight:${clientId}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)
  
  const metrics = await getClientMetrics(clientId)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize performance: ${JSON.stringify(metrics)}`
      }]
    })
  })
  
  const insight = await response.json()
  await redis.setex(cacheKey, 86400, JSON.stringify(insight))
  return insight
}
```

---

## Agent Interaction Map

```
[Vercel Cron: 2 AM daily]
     ↓
[POST /api/cron/sync] 
     ↓
[BullMQ Queue: Queue sync job per active client]
     ↓
[syncAgent(clientId)]
  ├─ Fetch creds from Supabase Vault
  ├─ Promise.allSettled([GSC, GA4, Semrush])
  │    ├─ GSC → transformAgent → normalize
  │    ├─ GA4 → transformAgent → normalize
  │    └─ Semrush → transformAgent → normalize
  ├─ insertSnapshots(clientId, normalized)
  ├─ updateCurrentMetrics(clientId, normalized)
  ├─ cacheAgent.markStale(clientId, platform)
  └─ logSync(clientId, status, error)
     ↓
[Supabase: metrics_snapshots + current_metrics updated]
     ↓
[Dashboard reads from current_metrics (fast)]
     ↓
[UI checks is_stale flag → shows stale banner if true]
     ↓
[User requests insights → insightsAgent(clientId)]
     ↓
[Claude API generates summary, cache 24hrs]
```

---

## Deployment Strategy

| Service | Provider | Purpose |
|---------|----------|---------|
| Next.js App | Vercel | Frontend + API routes |
| Database | Supabase | Postgres: metrics, clients, creds, logs |
| Queue | BullMQ + Upstash Redis | Job processing, retry, circuit breaker |
| Cron Trigger | Vercel Functions | POST /api/cron/sync @ 2 AM daily |
| Credentials | Supabase Vault | Encrypted API keys, not in .env |
| Auth | Supabase Auth | Google OAuth, JWT tokens |
| Logging | Supabase table | sync_logs for audit trail |
| Cache | Upstash Redis | Stale flags, AI insight cache |

---

## Error Handling Per Agent

| Agent | Failure Mode | Behavior |
|-------|--------------|----------|
| API Sync | API down | Retry 3x (1s → 4s → 16s), mark stale, log error, continue with other APIs |
| API Sync | 5+ consecutive failures | Pause client sync, fire circuit breaker, alert admin |
| Transform | Invalid schema | Log error, discard bad row, continue (partial insert) |
| Cache | Redis down | Fallback to direct DB queries (slower), continue sync |
| Auth | Session expired | Redirect to login, preserve session state in localStorage |
| Insights | Claude timeout | Show "insights unavailable" widget, no crash |
| Cron | Job queue full | Retry job next run (BullMQ handles backpressure) |

**Logging Pattern:**
```ts
// Never log credentials
await logSync({
  clientId,
  platform, // 'gsc' | 'ga4' | 'semrush'
  status, // 'success' | 'partial' | 'failed'
  error: sanitizedMessage, // no API keys
  recordsSynced: count,
  durationMs: elapsed,
  createdAt: new Date()
})
```

---

## Planned API Route Definitions

Only `/api/cron/sync` is implemented, and as `GET` (Vercel cron sends no body) — see § HTTP surface for the real contract. The `POST` shape below is the original spec, kept for reference.

### Cron Trigger
```
POST /api/cron/sync
Authorization: Vercel cron secret
Body: { secret: VERCEL_CRON_SECRET }
Response: { queued: number, errors: [] }

Purpose: Vercel cron calls this @ 2 AM daily. Queues sync job per active client.
```

### Manual Sync Trigger (Admin)
```
POST /api/sync/trigger
Authorization: Bearer JWT (admin only)
Body: { clientId: string }
Response: { jobId: string, status: 'queued' }

Purpose: Admin manually trigger sync for one client.
```

### Metrics Read (Client/Admin)
```
GET /api/metrics/{clientId}
Authorization: Bearer JWT
Query: ?days=30 (optional, defaults to last 30)
Response: { data: current_metrics[], is_stale: bool, last_updated: timestamp }

Purpose: Dashboard loads current metrics fast (from current_metrics cache).
```

### Metrics History (Client/Admin)
```
GET /api/metrics/{clientId}/history
Authorization: Bearer JWT
Query: ?start=2024-01-01&end=2024-01-31&metric_type=organic_traffic
Response: { data: metrics_snapshots[], metadata: {} }

Purpose: Fetch historical trends for date range comparison.
```

### Sync Logs (Admin)
```
GET /api/sync/logs/{clientId}
Authorization: Bearer JWT (admin only)
Query: ?limit=20
Response: { data: sync_logs[], total: number }

Purpose: View sync history and failure reasons.
```

---

## Build sequence (original POC plan)

Kept as the dependency order for the unbuilt parts. Marked against the code as of 2026-09-23, steps 1
and 3 re-marked 2026-09-25, step 3 again on 2026-10-12 — re-verify before trusting a line.

1. ✅ DB schema + migrations — six files under `supabase/migrations/` (recounted 2026-10-12).
2. ✅ Supabase Auth + Google OAuth + email/password + RLS policies.
3. ⚠️ API credentials model — a tenant can now read its own `api_credentials` status rows
   (`20260925000000_connections_read.sql`), surfaced at `/connections`. `credential_reference` is no
   longer merely unread: on the **local** stack Postgres denies it to `authenticated`
   (`20261010000000_credential_reference_unselectable.sql`, hosted pending its own yes), and nothing
   resolves it because no sync worker is hosted (steps 4-8). See the credential-resolution
   constraint under Planned agents §1.
4. ⬜ GSC sync agent (fetch → transform → store).
5. ⬜ GA4 sync agent.
6. ⬜ Semrush/Ahrefs sync agent.
7. ⚠️ BullMQ queue + cron endpoint — queue, worker process, and cron route exist; the worker performs no sync. **Blocked on a hosting decision**: nothing runs `lib/queue/worker.ts` in production.
8. ⚠️ `current_metrics` + `is_stale` — table, reads, and `markMetricsStale()` exist; no caller sets the flag.
9. ⚠️ Metrics read route — `/api/metrics/{clientId}/overview` and `/keywords` exist; the planned `/api/metrics/{clientId}` and `/history` do not.
10. ✅ Dashboard UI — metric cards, trends, keyword table, date range.
11. ⚠️ Stale banner + last_updated — the UI renders from `is_stale`, so the banner can never fire while step 8 has no writer.
12. ⚠️ Admin panel: provisioning shipped 2026-10-06 (`/admin`, `components/features/admin`, five `public` definer RPCs). Sync logs, credential writes and a manual sync trigger are still absent — nothing consumes the `seo-sync` queue.
13. ⬜ AI insight generation (Claude API).
14. ✅ CSV/PDF export behind a sliding-window quota (`lib/exports/quota.ts`).

Sequencing rule that still holds: schema → auth/RLS → sync agent per source → queue/cron → cache → read routes → dashboard → admin → insights. Do not build a read route before the agent that fills it, and do not build UI against a column nothing writes.

# VERIFICATION STANDARDS — Quality guardrails

A sentence earns its place in this file only if its author read the thing this session. These are the
failure modes no inline correction has closed yet.

| Bad line | Why it is wrong | Good line |
| --- | --- | --- |
| "60 tests passing." | A count rots the day someone adds a test — and `RULES`-era docs here carried exactly that kind of stale number. | Run the command, quote its output in the reply, type nothing into the doc. |
| "Integration tests pass." | The tier can collect nothing and still exit 0. § STANDING RULES 13 owns the file list and the `skipIf` mechanism — this row adds no rule, only the phrasing. | "integration tier: N passed, 0 skipped" — or say it skipped for want of `TEST_*` names. |
| "Build passes locally and in CI." | The build once fetched Geist from `fonts.googleapis.com` at build time, which a sealed runner cannot reach; the first CI run was red on it and the fix was to vendor the fonts. | Name the probe: `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build`. It passes here because `app/fonts/` and `lib/exports/fonts/` are vendored. |

# EDITING THIS FILE

`next dev` writes one thing: the text between `<!-- BEGIN:nextjs-agent-rules -->` and
`<!-- END:nextjs-agent-rules -->`. `upsertAgentRulesBlock()` in
`node_modules/next/dist/server/lib/generate-agent-files.js` (Next 16.3.5) replaces that span and
nothing else, so everything below it — including `# SERVICE ARCHITECTURE` — is hand-maintained and
never arrives by generation. Commit the marker block with your work rather than deleting it.

Any section that describes a surface changes in the same commit that alters that surface — a doc that
waits for a later cleanup commit is describing a state that no longer exists in the meantime.

## When each section changes
- **STANDING RULES** — when a rule about *how* work gets done changes. Not when a feature ships.
- **PROJECT OVERVIEW / ARCHITECTURE CONTEXT** — when a decision is made, before the code exists.
- **UI CONTEXT / CODE STANDARDS / DEVELOPMENT WORKFLOW / PM CONVENTIONS** — when the practice they
  prescribe changes, not when a feature ships.
- **SERVICE ARCHITECTURE** — implemented code only. When something becomes true, move it out of
  `# TARGET STATE` in the same commit that made it true.
- **TARGET STATE** — whenever intent outpaces implementation. Never cite it as current behavior.
- **FEATURE SPECS** — when `specs/` gains or loses a numbered file, or the split with
  `docs/superpowers/specs/` changes.
- **VERIFICATION STANDARDS** — when an inline correction closes a failure mode: delete its row rather
  than leaving a second authority.
- **EDITING THIS FILE** — when a section is added, renamed or moved, this list names it.
- **specs/** — one file per deliverable unit. `specs/00-template.md`.

## Completeness — the checks that work
No slot grep. The template's `grep -n '<[a-zA-Z_/]' AGENTS.md` cannot run against a filled file:
`<clientId>`, `<CRON_SECRET>` and `<type>(<scope>)` are real text here, so it reports noise forever
and trains people to ignore a gate. Instead:
1. Every § named by rule 14 exists: `grep -n "^# \|^## " AGENTS.md`.
2. Every file and route cited here exists: `git ls-files <path>`, `find app/api -name route.ts`.
3. Every command cited here exists: `pnpm run` lists them.
4. No census is typed in as a state claim — a count of tests, files or lines rots the day the thing it
   counts changes. Quote the command output in the reply instead. Not censuses: a version copied from
   the installed package, and a number inside an example of a report line.
