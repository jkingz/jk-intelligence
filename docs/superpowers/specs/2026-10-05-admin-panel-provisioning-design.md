# Admin panel: turn an inert sign-up into a user, guarded in Postgres

Date: 2026-10-05 · Status: approved section-by-section in conversation, draft for written review ·
Branch: `feat/app-shell-connections` (merged; `origin/main` is 2 commits ahead)

Supersedes `2026-09-24-admin-provisioning-design.md`. That draft was never implemented, and four of
its load-bearing lines were wrong — see §0. Everything else in it is absorbed here.

## 0. What this spec corrects in the draft it replaces

Each correction was found by reading the file the draft cited, not by arguing with its reasoning.

1. **Definer functions go in `public`, not `private`.** The draft put all five in `private`. PostgREST
   cannot route there: `supabase/config.toml:13` exposes `schemas = ["public", "graphql_public"]`, so
   an RPC in `private` is invisible to `supabase.rpc()` and every handler in §4 would 404. `private`
   holds only the two helpers that policies call server-side (`current_user_role()`,
   `current_user_client_id()`, `20260917000000_seo_poc.sql:126,136`). The in-repo precedent for an
   RPC a client calls is `public.persist_metrics` (`:215`), revoked from `public, anon, authenticated`
   and granted selectively at `:283-286`. This design follows that shape with the grant aimed at
   `authenticated`.
   *Rejected alternative:* add `private` to `config.toml`'s exposed schemas. That is a two-place change
   (local file + hosted project settings), it widens the API surface for every future `private` object
   instead of these five, and the drift between the two environments is exactly the class of bug
   `context/progress-tracker.md`'s hosted-policy-swap entry exists to warn about.
   One of the draft's three arguments for `admin_directory()` over `auth.admin.listUsers()` does not
   survive: it counted the RPC's 1000-row page limit as a defect of the *alternative*, but `max_rows`
   (`supabase/config.toml:18`) caps set-returning RPCs too (§3). The other two arguments — the
   service-role key in the request path, and merging two sources in memory — stand on their own, and the
   §10 probe measures the cap instead of arguing about it.
2. **The §7 error map needs a code-preserving wrapper, and it is not `databaseOperation()`.** The draft
   mapped `23505`/`45001`/`23503`/`42501` to HTTP statuses, but `lib/db/repository.ts` erases the Postgres
   code twice over: at all eleven of its `if (error) throw new Error("Database operation failed")` call
   sites (`:104,135,150,165,180,199,222,251,278,311,335`) and again in the `databaseOperation()` catch-all
   (`:76-86`). The code never reaches a handler, so the map is unreachable as written. Fix: admin RPCs use
   a feature-local `lib/admin/rpc.ts` that preserves `code`, and the shared wrapper stays alone. Its
   catch-all is recorded as an open, deliberate defect in `AGENTS.md` ("the underlying defect in the shared
   `lib/db` error wrapper stays open deliberately") and `RULES.md` §3 forbids widening that here.
3. **`NEXT_PUBLIC_ADMIN_EMAIL` would ship a credential.** The draft's bootstrap and `@auth` fixture env
   pair was `NEXT_PUBLIC_ADMIN_EMAIL`/`_PASSWORD`. Anything `NEXT_PUBLIC_` is inlined into the client
   bundle — the note at `scripts/create-demo-user.mjs:5` exists precisely because of that rule.
   Corrected to plain `ADMIN_EMAIL`/`ADMIN_PASSWORD`, which work for Playwright unchanged:
   `tests/helpers/load-e2e-env.ts:13` loads `.env` into the runner process for every spec.
4. **`admin_directory()` cannot `select … name from auth.users`.** The draft's body read four flat columns.
   `auth.users` has no `name` — the display name lives in `raw_user_meta_data ->> 'name'`, which is exactly
   how `lib/agents/authAgent.ts:55-58` reads it back (`data.user.user_metadata?.name`) — and `public.users`
   (`20260917000000_seo_poc.sql:20-27`) has four columns total, `id role client_id created_at`, with **no
   email and no name**. So the directory function projects
   `u.raw_user_meta_data ->> 'name' as name`, and §6's merge is the only place the two halves join: every
   email and display name the panel shows comes from `auth.users`, never from a `users` row.

Two gates also get a factual correction rather than a design change. `PROTECTED_PREFIXES`
(`lib/auth/routing.ts:22`) is `["/dashboard", "/connections", "/profile"]` — three entries, not the two
the draft quoted, so `/connections` is the line to model the addition on. And
`tests/platform/unit/destinations.test.ts:53-60` ("protects every destination it renders") checks
rail → prefix, never prefix → rail, so `/admin` can be a protected prefix with no rail row without
touching that test.

## 1. The blocking gap, from code

`docs/target-state.md:334` step 12 reads "Admin panel — no `components/features/admin`; clients and
credentials are provisioned by SQL/seed scripts". The folder is the least interesting half:

- `public.users` has one production writer — `scripts/create-demo-user.mjs:73` (upsert, hard-coded
  `role: "client"`) — and one test writer, `tests/fixtures/identity-users.ts:79`; `authAgent.ts:36` only
  reads. **There is no trigger on `auth.users` in any of the four migrations.** An account created through
  `/auth/sign-up` therefore has no `public.users` row, so `getAuthSession()` returns `user: null`,
  `listAccessibleClients()` returns `[]`, and the dashboard paints its empty shell. **Every self-signup is
  inert until someone with a psql session intervenes.**
- Reads for an admin already work. `clients_select_authenticated` and `users_select_self_or_admin`
  (`20260917000000_seo_poc.sql:155,162`) grant `select` on every row when
  `private.current_user_role() = 'admin'`. Nothing is needed to *see* what is already provisioned.
- Writes do not exist at all. The base migration ends at `revoke all … from authenticated` plus
  `grant select`, `20260920000001_rls_hardening.sql` strips grants from any table arriving
  RLS-disabled, and across all seven tables there is not one `for insert`, `for update` or `for delete`
  policy. So step 12 is a write-path design problem wearing a UI ticket, and its highest-value button
  is "attach this account".

## 2. Scope: provisioning only

Chosen over the fuller reading of `context/project-overview.md:74-80`. The excluded items are excluded
because **nothing consumes the `seo-sync` queue in production** (`AGENTS.md`, "Queue, worker, cron"):
`lib/queue/worker.ts` revalidates and returns `status: "mock_completed"`, and `persistMetrics`,
`markMetricsStale` and `writeSyncLog` have zero callers.

| Excluded | Why |
| --- | --- |
| Sync logs / run history | `sync_logs` has no production writer. UI over a column nothing writes. |
| Credential management | `/connections` reads `client_id, source, created_at` through `api_credentials_select_tenant_or_admin` (`20260925000000_connections_read.sql:17-18`), which is the read the app needs. A *write* path would store a key no code can resolve until the worker is hosted — and `credential_reference` is selected by nothing today. |
| Manual sync trigger | Would enqueue a job with no consumer. `components/features/dashboard/components/dashboard.tsx:132` already fakes this with `setTimeout(() => setSyncing(false), 800)`; replacing that fake with a real-looking fake is worse than the fake. |
| Invitations, join codes | No email transport, no token lifecycle, no new tables. |
| Left-rail admin row | See §0 gate note and §9 item 4's `08-app-shell.md` rewrite. `AccountMenu` is the entry point (§4). |
| Hard `DELETE` on a client | `api_credentials.client_id … on delete cascade` and `users.client_id … on delete set null`: deleting a client silently destroys its credentials and un-homes its members. Deactivate instead. |

## 3. Migration: five definer functions, zero new table grants

One file, `supabase/migrations/20261005000000_admin_provisioning.sql` — pinned so it sorts after
`20260925000000_connections_read.sql`, since `scripts/run-migrations.mjs` applies in filename order and
records each in the `public.schema_migrations` ledger. Five `security definer` functions in `public`,
`set search_path = ''`, bodies fully schema-qualified — the shape of `public.persist_metrics` (`:215`),
whose grant block at `:283-286` is the pattern: `revoke all on function … from public, anon,
authenticated;` then `grant execute … to`. Each gets that pair with the grant aimed at `authenticated`
rather than `service_role`. Written explicitly rather than leaned on: `config.toml:19-23` documents that a
*default* `auto_expose_new_tables` would make new `public` functions reachable without grants, and a design
whose security depends on a commented-out default is not a design. **No `grant insert/update/delete`
anywhere**, so `20260920000001`'s stance survives.

Each body opens with the same guard, and it must be the first statement because a definer function
bypasses RLS:

```sql
if private.current_user_role() is distinct from 'admin'
   then raise exception 'admin privilege required' using errcode = '42501';
end if;
```

`raise`, not "return no rows": for a write, an empty result still looks like success.
`is distinct from`, not `<>`, so a caller with no `users` row at all — role reads `null` — is refused
instead of passing a comparison that yields `null` and skips the branch.

| Function | Returns | Body notes |
| --- | --- | --- |
| `admin_directory()` | `table (id uuid, email text, name text, created_at timestamptz)` | `select u.id, u.email, u.raw_user_meta_data ->> 'name', u.created_at from auth.users u` (§0.4) — the half RLS cannot see. A set-returning function, so `max_rows = 1000` (`supabase/config.toml:18`) caps it: with six accounts today the cap is invisible, but probe §10.1 measures it rather than assuming, and the migration carries a one-line comment naming 1000. No `p_limit`/`p_offset` parameters for a directory that fits on two screens. |
| `admin_create_client(p_name text, p_domain text)` | `public.clients` | `lower(trim())` the domain, insert, `returning *` into the row. `23505` propagates untouched. |
| `admin_update_client(p_id uuid, p_name text default null, p_is_active boolean default null)` | `public.clients` | **No domain parameter at all.** Immutability is structural — an illegal call cannot be typed. Rename is in scope (decided in conversation), so this keeps both parameters. Each `null` means *leave that column alone*, which is safe because both columns are `not null` and so cannot be a legitimate value to write. Both-null is unreachable from the app: the route's zod schema requires at least one key. |
| `admin_attach_member(p_user_id uuid, p_role text, p_client_id uuid default null)` | `public.users` | **Upsert** keyed on the auth id, because sign-ups have no row to update. Promoting to `admin` forces `client_id = null` per `users_admin_has_no_tenant` (`:26`). The role value is bounded by `users_role_check`, which `20260920000000_add_staff_role.sql` rewrote to `('admin','client','staff')`. |
| `admin_detach_member(p_user_id uuid)` | `public.users` | `delete … returning * into v_row; if not found then raise exception 'no such member' using errcode = '45002'`. A definer function bypasses RLS, so `delete` reporting zero affected rows is the only way to learn the member was already gone — and an unguarded void return would make that look like success, the same failure `raise` was chosen over "return no rows" for above. |

Every write returns its row rather than `void`, so a handler can echo fresh state without a second round
trip, and `types/database.ts` gets a `Returns` it can actually check (`admin_directory` is the one array).

`lower(domain)` is load-bearing in two places at once: it is the unique index
(`clients_domain_key`, `:18`) *and* `scripts/seed.mjs`'s upsert key. An admin editing a domain would make
the next seed run insert a duplicate client — the reason the update function has no parameter for it.

Business-rule failures raise `45001`, so the handler switches on `error.code` and never parses message
text. The last-admin rule lives in `admin_attach_member` and `admin_detach_member`:

```sql
perform pg_advisory_xact_lock(800100);   -- two concurrent demotions of the last two admins
```

This is the repository's first advisory lock — grep for `pg_advisory` across `supabase/`, `lib/` and
`scripts/` returns nothing — so the key gets a comment naming what it guards, and `45001`/`45002` are
stated as this feature's reserved `raise` range. A magic number with no registry is how two features
discover they share one lock.

Self-demotion is legal provided another admin survives, so there is no special case for "you".
Text bounds (`name` 1–120, a bare host for the domain) belong to zod at the handler; `clients.name` has
no length check in DDL and this design does not add one to a shared table. Assigning someone to an
*inactive* client stays legal — that is what a paused tenant looks like to its staff.

The role set now lives in three places that must agree: `users_role_check` in DDL, zod's `memberRole`
(`lib/admin/schemas.ts`), and the `"admin" | "client" | "staff"` union repeated in `types/database.ts:85`
and `components/features/user-profile/lib/profile.ts:8`. The DDL check is the one that decides, the other
two only pre-filter, and §8's unit tier pins them with one table rather than trusting three comments.

## 4. HTTP surface and the two gates

| Path | Verb | Payload |
| --- | --- | --- |
| `app/(app)/admin/page.tsx` | — | inside the existing route group, so the shell wraps it. Server component, dynamic: it awaits the session through `requireAdmin()`, then `getAdminView()` |
| `app/api/admin/clients/route.ts` | `POST` | `{ name, domain }` |
| `app/api/admin/clients/[clientId]/route.ts` | `PATCH` | `{ name? }` or `{ isActive? }` |
| `app/api/admin/members/[userId]/route.ts` | `PUT` / `DELETE` | `PUT { role, clientId? }`; id in the path, matching `/api/metrics/[clientId]/*` |

Three route files, four verbs, plus the page. Every handler is the same five lines in the same order:

1. `requireAdmin()` (`lib/agents/authAgent.ts:76-80`) → 403 on `{ allow: false }`, before any db touch.
2. zod-parse the body (`lib/admin/schemas.ts`).
3. `callAdminRpc(name, args)` from `lib/admin/rpc.ts` — a **user-scoped** client
   (`createServerSupabaseClient()`, publishable key + session cookie). `getAdminDb()` is not imported
   anywhere under `lib/admin/`: service-role in the request path would make the definer guard the only
   thing between a handler bug and another tenant's rows, and would erase the role the RLS model is
   built on.
4. Map `PostgresError.code` → status via the §7 table (pure function, unit-tested).
5. Return `{ data }` or `{ error: string }` with the existing header shape — `no-store`,
   `Vary: Cookie` (`app/api/metrics/[clientId]/overview/route.ts:17-27`). Params come from
   `await ctx.params` on `RouteContext<"/api/admin/clients/[clientId]">`; this Next does not take them
   positionally.

Two gates, both required. `PROTECTED_PREFIXES` gains `"/admin"` (`lib/auth/routing.ts:22`) so `proxy.ts`
bounces anonymous visitors before the page renders, **and** the page calls `requireAdmin()` and redirects
to `/dashboard` — a prefix match proves a session exists, not that it is an admin. Each handler calls
`requireAdmin()` as a cheap early exit; the RPC's guard stays the enforcement point.

Entry point: `AccountMenu` already receives `ProfileView`, which carries `role`
(`components/features/user-profile/lib/profile.ts:4-12`), so the Admin item is one
`profile?.role === "admin"` conditional beside the Profile item
(`components/features/user-profile/components/account-menu.tsx:79-82`) — no change to
`/api/dashboard/boot`, no new server prop.

Which raises a question the earlier draft never asked, because it never checked where `AccountMenu`
renders: **only `/dashboard` does** (`app/(app)/dashboard/dashboard-view.tsx:236` passes it into the
dashboard header; the shell renders nothing of the sort). So the entry is a one-way door unless the panel
is framed deliberately. `app/(app)/admin/` puts it inside `app/(app)/layout.tsx`'s existing shell, which
costs no code — the layout renders `<AppShell>{children}</AppShell>` and reads no session, so it stays
unable to make `/dashboard` dynamic — and `activeDestination("/admin")` returns `null` rather than
throwing (`lib/navigation/destinations.ts:22-29`), so an unmatched path is a state the rail already
handles. The rail's Dashboard row is then the way back, and the panel needs no header of its own. The
trade is recorded in §7's limitations: the page the admin is standing on is not in the list beside it.
`app/admin/` outside the group would need its own header carrying a second `<AccountMenu>` or a bare back
link; both were rejected.

## 5. Component surface

```
lib/admin/
  rpc.ts           server-only callAdminRpc(): user-scoped client, preserves Postgres code
  schemas.ts       zod: clientName (1-120), domainHost (bare host), memberRole
  errors.ts        adminErrorStatus(code): number — pure, unit-tested
components/features/admin/
  index.ts                      barrel → AdminPanel
  components/
    admin-panel.tsx             two stacked regions + mutation state
    client-table.tsx            name · domain · status · members · rename / deactivate
    client-dialog.tsx           one form for create and rename
    member-table.tsx            email · name · role · client · detach
    attach-member-dialog.tsx    directory accounts with no users row yet
  lib/
    provisioning.ts             server-only getAdminView() — mirrors user-profile/lib/profile.ts
    mutations.ts                four calls + router.refresh()
```

`lib/admin/*` holds no React: `rpc.ts` is `import "server-only"`, while `schemas.ts` and `errors.ts` are
pure. `components/features/admin/lib/` follows the `user-profile` precedent (`lib/profile.ts` sits inside
the feature). `docs/conventions/feature-components.md:7,43-44` requires the spec in
`context/feature-specs/` and a tracker "In Progress" entry before implementation — both in §9.

Stacked, not side-by-side, and it stays that way at `lg`: a member row needs email + role + client and a
client row needs domain + member count, so two columns would only shrink both. Row edits commit on
change — picking a role or client in a `Select` fires the `PUT` under `useTransition`, disables the row,
and toasts on failure; dialogs use `startStatusToast`/`finishStatusToast` (`lib/toast-status.ts:10,17`).

Deliberately absent: `revalidateTag` (`/api/dashboard/boot` is already `revalidate: 0`, and deactivating a
client changes no metric row, so a tag call would invent a coupling); `useOptimistic` (control-plane writes
are one at a time, and a pending row is honest); any new `components/ui/*` — no `form`, `label`, `switch`
or `data-table` exists, and none is added: a bare `<form>` with `<label htmlFor>` per
`email-auth-form.tsx:98`, and Active/Inactive as a plain `Button`.

Phone width gets the lesson from the last session: both tables sit inside
`<div className="relative overflow-x-auto">` — the *positioned* clipper, so `sr-only` descendants cannot
escape it — and secondary columns drop below `sm`.

## 6. Why reads are a merge, not a query

`getAdminView()` returns `{ clients, members, directory }` where `members` are `public.users` rows
(`id, role, client_id, created_at` — that is the whole table, §0.4) and `directory` is `admin_directory()`.
The panel shows both because they answer different questions: the directory is *who exists* (auth), `users`
is *who is provisioned* (tenant). An account in the directory with no `users` row is the inert-signup case
from §1 and is the row the admin is there to act on — so the merge is a left join by `id` done in
TypeScript over two RPC results, and "attach" is the label on the gap.

One consequence for the two tables: every **email and display name the panel renders comes from the
directory**, because `public.users` stores neither. The Members table is therefore the join (every
`users.id` FK-references `auth.users(id)` at `:21`, so a member always has a directory twin), and the
Attach dialog is the set difference. The Clients table's member count falls out of the same pass —
`members` grouped by `client_id` in TypeScript, so no `count(*)` RPC and no per-client query.
Nothing here decides visibility; Postgres already did that, twice, inside the definer and inside the
policies (`RULES.md` §15).

## 7. Errors and empty states

Responses follow the existing shape — `{ error: string }`, explicit status, `no-store`, `Vary: Cookie`.

| source | cause | HTTP | toast |
| --- | --- | --- | --- |
| zod fail | name length, `http://` or a path in the domain | 400 | the specific rule, not "invalid input" |
| `23505` | `clients_domain_key`, case-insensitive collision | 409 | "Another client already owns that domain." Dialog stays open, focus on the field. |
| `45001` | last admin would lose the role | 409 | "Assign another admin before removing this one." |
| `23503` | the client row vanished mid-edit, or an id with no `auth.users` row | 409 | "That client no longer exists." / "No such account." — the handler knows which RPC it called, so it picks without reading message text. |
| `45002` | `admin_detach_member` matched no row (§3) | 409 | "That account is not provisioned." Two tabs, one already detached. |
| `42501` | definer guard — a tab left open past a demotion | 403 | "You no longer have admin access." |
| `23514` | `users_admin_has_no_tenant` — unreachable, since promote nulls `client_id` | 500 | loud; a polite message here would hide a function bug |
| anything else | db unreachable | 502 | "Could not reach the database." |

Only refresh on 2xx: after a refusal the server data is already correct, so `router.refresh()` would
flicker a row the admin just watched decline to change.

Empty states, in the order a real account meets them:
- **The bootstrap state is the normal one** — one admin from the script, no other `public.users` rows,
  Clients full of seed data. So the primary affordance is Attach, and an empty Members table says
  "Accounts that signed up but were never provisioned appear here."
- Provisioned-but-unassigned renders "Unassigned", not an error: a `client` with `client_id = null` is
  legal and logs into the empty shell. Surfacing that is one of the panel's jobs.
- All accounts attached → "Every account is already provisioned."
- Zero clients → Create is the only action; the regions stack rather than collapsing.

No control hides itself based on who you are. Your own row still offers Detach and Postgres answers
`45001` — suppressing the button would copy the last-admin rule into TypeScript. Accepted limitations,
named rather than discovered later: two admins editing one client is last-write-wins (`clients` has no
`updated_at` or version column, and this design does not add one); a non-admin hitting `/admin` is
redirected rather than shown a 403 page; the rail renders on `/admin` with no destination marked active,
because `/admin` is a protected prefix and not a destination (§4); and the directory stops at 1000
accounts (§3).

## 8. Tests

| Tier | Proves | CI |
| --- | --- | --- |
| `tests/admin/unit/` | `requireAdmin()` runs before any db touch; zod rules; the §7 code→status map as a pure function; `getAdminView()`'s directory ∪ provisioned merge; `callAdminRpc` preserves `code` (the §0.2 regression, tested at the boundary that broke) | yes, `pnpm test` |
| `tests/admin/integration/` | the guard denies a non-admin; domain uniqueness; promote nulls `client_id`; the last-admin refusal | skipped in CI, run locally — see below |
| `tests/identity/e2e/admin-guard.spec.ts`, public | anonymous `/admin` → `/auth/login?next=%2Fadmin` | yes, mirrors `connections-guard.spec.ts:6-10` |
| `tests/admin/e2e/`, `@auth` | admin sees the panel; a logged-in `client` is bounced off `/admin`; no overflow at 320/390 — **read-only**, see below | no — `@auth` is already outside CI |

The guard case goes to `identity`, not `dashboard`: `AGENTS.md`'s folder table assigns
`lib/auth/routing` — the `PROTECTED_PREFIXES` list that implements it — to `identity`. A test lands in the
feature that owns the invariant, and a new `admin` row is added to that table for `lib/admin/*` and
`components/features/admin` (§9). `tests/identity/unit/routing.test.ts` asserts per-path cases and no
exhaustive list, so adding `/admin` breaks nothing; one case is added for it.

Why `@auth` stays read-only: it would be the first browser spec in the repo to write. The five today
(`tests/dashboard/e2e/{mobile-layout,overview,rail,tab-deep-link}.spec.ts`, `tests/export/e2e/csv.spec.ts`)
all read or download — grep for a sign-up, `.insert(` or a `POST` across `tests/*/e2e/` returns nothing —
and §2 ships no `DELETE` route for clients on purpose, so a client created by a test is immortal and its
member count drifts between runs. The definer is the enforcement point and the integration tier already
proves create/attach/detach against real Postgres, so a click-through would duplicate that coverage and
invent a service-role teardown helper for one spec. Accepted cost: nothing asserts that pressing *Create
client* in a browser round-trips. The unit tier owns the handler, the integration tier owns the function,
and `@auth` owns the two things only a browser can see — the role gate and the phone-width clip.

Extract the §7 mapping into `lib/admin/errors.ts` before writing its test — a table living inside a route
handler cannot be unit-tested without a fake `Request` per row.

Integration tier: the merge rule in `2026-09-23-test-suite-architecture-design.md:14,286` is that the RLS
slice does not merge until it has run green once against a real stack, and the substrate for that exists
now — `.env.test` carries all four `TEST_*` names, `requireTestDb()` gates on them and re-binds
`NEXT_PUBLIC_SUPABASE_URL`/`_PUBLISHABLE_KEY` to that stack so no call can reach the live one
(`tests/fixtures/identity-users.ts:19-27`), and `rls-gate.test.ts` has been green twice including after
`supabase db reset` (`context/progress-tracker.md`, "Run the live tier with `pnpm exec supabase start` +
`.env.test`"). So these four cases run; they are not a written-but-unexecuted deposit, and the deviation the
2026-09-24 draft §0.1 argued for is moot. `.github/workflows/ci.yml` injects no `TEST_*` name (grep: 0
matches), so CI still skips the tier — report the passed/skipped split and quote the skip line in the
tracker, because exit 0 alone reads like coverage it never had. Per `tests/fixtures/README.md:41`, inserts
go through the service-role client while every assertion goes through the user-scoped one.

Fixtures: `tests/fixtures/README.md:26-32` prescribes three users; this adds a fourth row — `admin@`,
`users.role = 'admin'`, `client_id = null` — in the same change, in `FIXTURE_USERS`
(`tests/fixtures/identity-users.ts:13-17`) and through its existing `linkUser()` helper, whose role union
already lists `"admin"` (`:75`) while nothing provisions one. The `@auth` tier needs an admin, and §9's
`--admin` flag produces one: the bootstrap and the fixture are the same account.
`tests/helpers/log-in.ts:3` today reads only `DEMO_EMAIL`/`DEMO_PASSWORD` and asserts `/dashboard`, so it
widens to take a role (and, for admin, still lands on `/dashboard` before navigating).

TDD order, since every one of these is behavior: the §10 probes → failing unit test for the error map →
the migration → route tests → the page.

## 9. Bootstrap, docs duty, and the gate

`scripts/create-demo-user.mjs:11-12` reads `DEMO_EMAIL`/`DEMO_PASSWORD` (private env since the 2026-09-24
Q4 fix), and its upsert hard-codes `role: "client"`. `--admin` switches the source to
`ADMIN_EMAIL`/`ADMIN_PASSWORD` (§0.3) and the role to `admin` with `client_id = null`, rather than
inventing a positional argument — one env pair serves both the operator's bootstrap and §8's fixture.

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=… node scripts/create-demo-user.mjs --admin
→ auth.admin.createUser + users { role: 'admin', client_id: null }
```

Guard the footgun the script already has: `:45` lists up to 1000 auth users to find a match, so it must
refuse to run `--admin` when the address is absent **and** the list was truncated, instead of silently
creating a second admin. `role` stays only in the `users` row — where `AGENTS.md` says it must live — not
in a migration every environment replays, and not derived from an env var at session time.

Docs, in the order they become true:

1. `context/feature-specs/07-admin.md` — required before implementation by
   `docs/conventions/feature-components.md`. The number is 07: `01`–`06` exist and `08`/`09` took the
   slots after it.
2. `types/database.ts:93-103` — the handwritten `Functions:` map holds `persist_metrics` alone. Add the
   five with their `Args`/`Returns` (`admin_directory` returns an array of records, so its `Returns` is the
   row type `[]`), or `supabase.rpc("admin_create_client", …)` has no type to check.
3. `AGENTS.md` — the HTTP table gains four entries (`/admin` as a page row, three API route rows), with
   `/connections` as the shape to copy: page in the `app/(app)/` group, session + RLS in the Auth column;
   the test-folder table gains an `admin` row; the tenant-isolation paragraph gains one line: admin writes
   go through `public` definer RPCs called with the user-scoped client, never table grants and never
   `getAdminDb()`. "There is **no** admin panel page" in "Pages and caching" is deleted in the same edit,
   and the request-path diagram gains the `/admin` hop.
4. `context/feature-specs/08-app-shell.md:21-23` — its "Role-gated destinations" non-goal currently says
   "The admin panel adds its row and the filter together." That is superseded: the rail stays at three
   destinations and the shell stays session-blind, because reading a session in `app/(app)/layout.tsx` is
   what would make `/dashboard` dynamic. The rewrite records the AccountMenu decision, why the
   `visibleDestinations(role)` filter still has zero callers, and the new fact from §4 — the filter has no
   caller, but `/admin` is now a page the shell wraps with `activeDestination()` returning `null`, which is
   a state worth describing rather than leaving to the reader.
5. `context/progress-tracker.md` — an In Progress entry; `docs/target-state.md:334` step 12 becomes the
   only line this change is allowed to check off.

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # ƒ /admin, and /dashboard still ○
pnpm test:integration                                     # needs the local stack + .env.test
```

## 10. Two probes, before any of §3 is built

Both probes run against the **local `supabase start` stack** — the same database the integration tier
already exercises — by exporting `SUPABASE_DB_URL` to its local connection string before
`node scripts/run-migrations.mjs`. Never bare: `SUPABASE_DB_URL` in `.env` on this checkout targets hosted
production with no `.env.local` to shadow it (`RULES.md:87`), and the migration runner takes whatever it
finds (`scripts/run-migrations.mjs:8-16`). No new infrastructure, and applying this migration to the
**hosted** project is a separate explicit yes — this branch's hosted history (`context/progress-tracker.md`,
2026-09-30, where the policy swap was applied and then verified only inside rolled-back transactions) is
the reason that is not assumed.

1. **Can the migration role `select` from `auth.users` from inside a `security definer` function?**
   `admin_directory()` assumes yes. It is the one assumption that could invalidate §3's read side. If it
   fails, the fallback is `auth.admin.listUsers()` in `lib/admin/rpc.ts`, which puts the service-role key
   in the request path for a read the RLS model cannot see — and if that is chosen, the trade is recorded
   there, not discovered later.
      The same probe answers a second question that is load-bearing for the guard rather than for the read:
   does `private.current_user_role()` still see the *caller* when it is nested inside another definer
   function? It reads `auth.uid()`, which takes the per-request JWT claims GUC rather than `current_user`,
   so it should — and the same `security definer` helpers already decide every tenant policy
   (`20260917000000_seo_poc.sql:126-152`, granted `to authenticated, service_role`). But if it resolved the
   function *owner* instead, all five admin RPCs would open to every signed-in user, so this is proven by
   the first integration case (a non-admin caller receives `42501`) and not assumed from the policies that
   already work.
   Same probe, one extra line of output: `select count(*) from auth.users` beside the row count the RPC
   actually returns, so §3's 1000-row ceiling is measured here rather than inherited from a config comment.
2. **Does `/admin` build as `ƒ`, and is `/dashboard` still `○`?** The gate is `pnpm build`'s route table,
   not an assumption about cookies. Note the `force-dynamic` precedent: `/connections` declares it because
   `databaseOperation()`'s catch-all turns Next's prerender bailout into
   `Error("Database operation failed")` and `pnpm build` fails without the declaration
   (`AGENTS.md`, "Pages and caching"). `/admin` awaits the cookie-bound `getAdminView()`, so it may need the
   same line — decided by the probe, and if it does, that is the second live instance of the §0.2 defect
   and gets a sentence in the tracker.

## 11. Open questions this spec does not settle

1. `member-table.tsx` shows every account to every admin. Is a member's email sensitive enough to want a
   per-column rationale later, or is admin-of-all the model you actually want?
2. When the worker-hosting decision lands, does `sync_logs` get its admin view in this page (a third
   region) or its own route? It affects nothing today and is cheaper to decide now than to migrate later.
3. Does `admin_detach_member` need a "you cannot detach yourself last" analogue at the UI level when the
   admin is viewing their own row, or is the §7 `45001` toast enough? This spec says the toast is enough
   and hides nothing; if that reads as hostile in practice, the fix is the message, not the control.
