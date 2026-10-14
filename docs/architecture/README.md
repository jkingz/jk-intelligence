# SERVICE ARCHITECTURE — implemented surface

This section describes only code that exists. Design intent for what is **not** built lives in
§ TARGET STATE; never cite that section as current behavior.

## Request path

```
proxy.ts (session refresh via updateSession)
  → app/api route handler
    → lib/api/guard.ts          — 401/403/503 shape + the gates, shared by the session-gated route files
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
- `lib/api/guard.ts` holds the response shape — `NO_STORE`, `json`/`badRequest`/`unauthorized`/
  `forbidden`/`databaseFailure` — the gates `gateNullable`/`gateSession`/`gateAdmin` (typed
  `Gate<null>`; `requireAdmin()` returns no user)/`gateClientAccess`/`resolveAccessibleClient`, and the
  two body helpers `readJsonBody`/`firstIssueMessage`. It is a thin caller of the two RLS probes
  (`gateClientAccess` → `canAccessClient`, `resolveAccessibleClient` → `listAccessibleClients`); it owns
  no ownership rule. `lib/admin/http.ts`, which used to own the admin trio's shape, is deleted.
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

