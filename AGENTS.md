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
- State assumptions plus the step that would verify them. Missing requirement → record it as an open question, then continue.
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
- `pnpm test` is the **unit project**, not the whole suite. The `integration` project is `tests/*/integration/**/*.test.ts` — **three files / 21 tests as of 2026-10-12**: the two live-RLS files `tests/tenant-isolation/integration/rls-gate.test.ts` (`clients`, 5) and `credentials-visibility.test.ts` (`api_credentials`, 6), plus `tests/admin/integration/provisioning.test.ts` (admin definer RPCs, 10), run against the local stack. All three `skipIf(!TEST_SUPABASE_URL)`, so a green tier can mean *nothing ran* — read the passed/skipped counts, not the exit code. E2E is a separate runner. Run `pnpm test:all` and `pnpm test:e2e` before pushing. Narrow with `pnpm test dashboard`, never `pnpm test -- dashboard` — the latter silently runs everything.
- Route handlers get a `<name>-route.test.ts` covering 401 / 403 / 400 and the no-data-leaked-before-auth path.

### 14. Read order
`AGENTS.md` § STANDING RULES → then, for architectural decisions, § APPLICATION BUILDING CONTEXT in
order: Project Overview → Architecture Context → UI Context → Code Standards → Development Workflow
→ PM Conventions. Then § SERVICE ARCHITECTURE for what exists, § TARGET STATE for what does not.

**Transitional — still authoritative as separate files:** `context/architecture-context.md`,
`context/ui-context.md`, `context/code-standards.md`, `context/development-workflow.md`,
`context/pm-conventions.md`, `docs/target-state.md`, `context/progress-tracker.md`. Delete an entry
in the commit that folds its file in; the entry is a pointer, not a note.

### 15. Tenant isolation is RLS's job
- Client-ownership is decided only by `canAccessClient` / `listAccessibleClients` in `lib/db/repository.ts`. No route or helper may re-implement that rule in TypeScript.
- `AGENTS.md` describes implemented code only; anything not built lives in `docs/target-state.md`. Never cite target-state as current behavior, and check a module exists before assuming it does (`lib/agents/` holds only `authAgent`).

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
`scripts/seed-connections.mjs`), any LLM integration (no `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY`,
no Claude call in the repo), and a consumer for the `seo-sync` queue in production.

Verified: 2026-10-13, against the repo at the commit this section was ported into.

State of record: `context/progress-tracker.md`.

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

# SERVICE ARCHITECTURE — implemented surface

This file describes only code that exists. Design intent for what is **not** built lives in
`docs/target-state.md`; never cite that file as current behavior.

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
| `syncAgent` / `transformAgent` / `cacheAgent` / `insightsAgent` | **do not exist** — spec only, see `docs/target-state.md` |

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
`20260925000000_connections_read.sql`. `api_credentials` is readable through
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
own yes. The accepted limitation both this file and `context/feature-specs/09-connections.md` used
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

Planned and absent: `POST /api/sync/trigger`, `GET /api/metrics/{clientId}`,
`GET /api/metrics/{clientId}/history`, `GET /api/sync/logs/{clientId}`.

## Queue, worker, cron

- `lib/queue/syncQueue.ts` — BullMQ on Upstash Redis, queue name `seo-sync`, zod-guarded job body.
- `lib/queue/worker.ts` — `pnpm worker` runs it locally. It currently revalidates the dashboard and
  returns `status: "mock_completed"`: no API fetch, no rows written.
- **Nothing consumes the queue in production.** Vercel hosts only the cron; hosting the worker
  (always-on process, inline-in-cron, or QStash) is an open decision — see
  `context/progress-tracker.md`.
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
`context/feature-specs/07-admin.md` tracked is closed, and `AccountMenu` is deleted.
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

## Verification

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # the gate
pnpm test:all                                            # + integration tier — needs the local stack: `pnpm exec supabase start` and a filled `.env.test`
pnpm test:e2e                                            # public Playwright specs
```

The integration tier — `tests/tenant-isolation/integration/rls-gate.test.ts` (`clients`) and
`credentials-visibility.test.ts` (`api_credentials`) — is the only evidence that the RLS policies
actually decide visibility; both `skipIf` on `TEST_SUPABASE_URL`, so the tier skips with a warning
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

`.claude/skills/` is the source of truth; `.agents/skills/` mirrors it for other loaders, and the
mirror is **not** one mechanism: some entries are symlinks, some are genuine hardlinks (shared
inode), and some are plain independent copies. Edit the `.claude/` file and then check the
counterpart with `ls -i` / `readlink` rather than assuming either propagates. `.opencode/` carries only `commands/feature-component.md` — its own `.gitignore` keeps
the tool's `node_modules/` and `package.json` untracked, so do not expect skills there.

- `babysitting-a-pr` + `leaving-pr-comment` — how PR review bots, comments and checks get handled
  and worded. Also installed user-level, so they apply to every repo.
- Stack: `code-review`, `feature-component`, `frontend-design`, `shadcn`, `supabase`,
  `supabase-postgres-best-practices`, `tailwind-design-system`, `motion-design`, `playwright-cli`,
  `migrate-radix-to-base`.
- Visual direction: `design-taste-frontend`, `stitch-design-taste`, `high-end-visual-design`,
  `redesign-existing-projects`, `minimalist-ui`, `brandkit`, `gpt-taste`, `image-to-code`,
  `imagegen-frontend-web`, `imagegen-frontend-mobile`.
- `.agents/skills/` mirrors only a 13-entry subset. `ls` both before assuming a skill is reachable
  from another loader, and never edit a skill in one place without the other.

## Editing this file

`AGENTS.md`'s top block ("This is NOT the Next.js you know" through the context-file list) is
regenerated by `next dev` — commit it with your work rather than deleting it. Everything below the
`# SERVICE ARCHITECTURE` heading is hand-maintained: update it in the same change that alters the
surface described here, and move newly built modules out of `docs/target-state.md`.

# TARGET STATE — Not Yet Built

Design intent that is **not** implemented. Treat this section as requirements for future work,
**never** as a description of current behavior.

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

- Daily cron job (2 AM) syncs all active clients.
- Parallel API calls per client (Promise.allSettled — partial failure safe).
- Sources: Google Search Console, GA4, Semrush/Ahrefs.
- Retry: exponential backoff (3 attempts per source).
- Circuit breaker: pause after 5 consecutive failures, alert admin.
- Sync logs persisted per client per run.

### AI Performance Insights

- Claude API generates plain-English summary per client.
- Input: current metrics + historical deltas.
- Output: top wins, top declines, recommended focus areas.
- Cached (not regenerated daily — cost control).

### Admin Panel

- Add/manage clients and API credentials (stored in Supabase Vault).
- View sync logs and failure alerts per client.
- Manual sync trigger per client.
- Activate/deactivate clients.

### Data Export

- CSV export of historical metrics.
- PDF report generation (per client, per date range).
