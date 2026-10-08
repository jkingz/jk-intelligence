# Admin Panel: Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an admin a page that turns an inert self-signup into a provisioned member and lets them register, rename, and deactivate clients — with every write guarded inside Postgres, not in TypeScript.

**Architecture:** Five `security definer` functions in `public` perform all writes; the app calls them through the **user-scoped** Supabase client, so the function's own role guard is the enforcement point and no new table grant exists. Reads are ordinary RLS-gated table selects plus one set-returning directory function over `auth.users`, joined in TypeScript because email and display name live only in auth. The page lives in `app/(app)/admin/`, inside the existing shell, entered from `AccountMenu`.

**Tech Stack:** Next.js 16.3.5 fork (route groups, `RouteContext<T>`, `await ctx.params`), Supabase Postgres (RLS, definer functions, advisory locks), zod v4, Vitest 5 workspace (`unit` / `integration` projects), Playwright (`public` / `auth` projects), Tailwind + base-ui-backed `components/ui/*`.

**Spec:** `docs/superpowers/specs/2026-10-05-admin-panel-provisioning-design.md` (committed as `face40d`). Read it end to end before Task 1. Every `§n` below points into that file; the plan argues from it and does not restate its reasoning.

## Global Constraints

Every task's requirements implicitly include this section.

- **Gate after every task**, before committing: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. Baseline as of `face40d`: `pnpm test` → **Test Files 26 passed (26) / Tests 160 passed (160)**; `pnpm build` must keep printing `○ /dashboard` and finish with no warnings. A task is not done until all four are green in the same run.
- **Never run a `db:*` script bare.** `SUPABASE_DB_URL` in `.env` on this checkout points at **hosted production** (`RULES.md` §16). Every migration or seed command in this plan is prefixed with an explicit local connection string.
- **Applying the migration to the hosted project is a separate explicit yes.** Nothing in this plan does it. Local stack only.
- **No `getAdminDb()` anywhere under `lib/admin/`.** Service-role in the request path would make the definer guard the only thing between a handler bug and another tenant's rows (§4.3).
- **No new table grants.** `grant execute … to authenticated` on the five functions and nothing else (§3).
- **A response body carries only strings written in `lib/admin/errors.ts`.** Never forward Postgres message text, `DETAIL`, or a column name the UI does not already show.
- **Never select, render, or log `credential_reference`.**
- **No `NEXT_PUBLIC_*` for credentials.** The admin bootstrap pair is `ADMIN_EMAIL` / `ADMIN_PASSWORD` (§0.3).
- **Zero new npm dependencies and zero new `components/ui/*`** (§5, "Deliberately absent").
- **`@auth` e2e stays read-only.** No browser spec creates a client or attaches a member (§8).
- **`context/` files are updated in the same task that makes them true** (§9), and `AGENTS.md` below the `# SERVICE ARCHITECTURE` heading is hand-maintained — edit it, do not regenerate it.
- **Finish each task, run its gate, then stop and report the diff — do not commit until King says so.**
  He asked for this on 2026-10-05, partway through execution: he reads the code changes before they
  become a commit. Do not push and do not open a PR either way (`RULES.md` §7).
- Copy rules: sentence case in buttons and headings, no em-dash filler, status strings owned by the component that renders them.

## Known deviations from the spec

These seven were found by reading code while planning. Each is deliberate, each is listed here once, and the task that enacts it says so in one line.

1. **The client list must not come from `listAccessibleClients()`.** That helper is built on `selectActiveClients()` (`lib/db/repository.ts:92-110`), which appends `.eq("is_active", true)` — so an admin who deactivates a client would watch it vanish from the panel with no way back. `getAdminView()` reads `clients` directly with `select("id,name,domain,is_active")` and no `is_active` filter. §4's read side says "reads for an admin already work"; it means the policy, not that helper.
2. **`admin_attach_member` collapses §7's two `23503` messages into one.** Both halves of that row (missing client, missing auth account) come from the same FK on `users.client_id` and the same upsert, so the handler cannot tell them apart from `error.code` alone. The single message is `"That account or client no longer exists."` — one string, no message parsing.
3. **The role set gets a single source of truth in `types/metrics.ts`.** §3 names three places that must agree and asks §8's unit tier to pin them with a table. Rather than pin three literals, `export const MEMBER_ROLES = ["admin", "client", "staff"] as const` plus `export type MemberRole` joins the file every one of them already imports, and a test asserts it equals the list inside `users_role_check`'s DDL. See Task 4.
4. **The fixture helper is `ensureLink`, not `linkUser`.** §8 cites `linkUser()`; the real name at `tests/fixtures/identity-users.ts:72-85` is `ensureLink`. Same function, same signature, already typed for `"admin"`.
5. **The 1000-row directory cap is partly unmeasurable, and that gets recorded rather than papered over.** `max_rows = 1000` (`supabase/config.toml:18`) is a PostgREST limit, so a `psql` call cannot observe it; the probe measures the SQL side and the row count, and the cap is then reported as **inherited from config** unless the synthetic overflow passes. See Task 2. **Closed during execution (2026-10-05): measured.** A set-returning definer probe returned exactly 1000 rows against 1003 in `auth.users`, so the ceiling is real and the inherited-from-comment framing is no longer needed.
6. **`docs/target-state.md` step 12 becomes `⚠️`, not `✅`.** The panel ships provisioning only; sync logs, credential writes, and the manual trigger are still absent (§2), so a clean check would be a new false claim. The line reads done-for-provisioning.
7. **Two extra leaf files beyond §5's tree**: `lib/admin/http.ts` (the JSON response + body-read trio the four handlers share — repeating fifteen header lines four times is how one of them drifts) and `components/features/admin/lib/select-items.ts` (the `Select` `items` arrays, which must be plain data because base-ui's `Select` takes `items` as a prop). Both are leaf modules with one importer group; no behaviour moves into them.

## Substrate notes, corrected during execution (2026-10-05)

Three commands in this plan assumed tooling this machine does not have. The intent of every step is
unchanged; the mechanism is not what is written below in Tasks 2, 3, and 5.

- **`psql` is not on PATH.** Every `psql "$pg" -c "…"` in this plan became a throwaway `.mjs` under
  `/tmp` using the repository's existing `pg` dependency (`scripts/run-migrations.mjs:5` already
  imports it), loaded from a project script with `createRequire("<repo>/package.json")` so module
  resolution works outside the repo. It refused any connection string that was not
  `127.0.0.1:54322` — the same guard the plan's "never bare" rule wants.
- **`.env.test` carries four names only** — `TEST_SUPABASE_URL`, `_PUBLISHABLE_KEY`,
  `_SERVICE_ROLE_KEY`, `TEST_DEMO_PASSWORD`. There is **no `TEST_DATABASE_URL`**, so
  `grep -m1 '^TEST_DATABASE_URL=' .env.test` yields an empty string, and because
  `run-migrations.mjs:10` uses `??` an empty `SUPABASE_DB_URL` does not fall through — it reaches
  `pg` and fails. Use the local stack's own string: `pnpm exec supabase status` prints it, currently
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- **`supabase db query --local --file X.sql` refuses a multi-statement file** ("cannot insert
  multiple commands into a prepared statement"). There is no `--sql` flag either — a single
  statement is a positional argument (`supabase db query --local "select …"`). A migration-sized
  file goes through `pg`, which is how Task 3's verification queries are run as well.
- **Docker Desktop must already be running.** `pnpm exec supabase start` fails with
  `Cannot connect to the Docker daemon` otherwise, and `supabase status` reports that rather than
  "stopped".
- **Auth keys are stable across local restarts.** `.env.test`'s pair signed in against a freshly
  started stack without re-exporting, which is what makes the integration tier's `withSession()`
  reproducible.

### What the plan got wrong, caught by running it

Nine findings from executing the steps rather than trusting the drafted code. Items 1-2 are SQL and
were only visible against a live Postgres; items 4, 5 and 8 were only visible against the plan's own
tests or typecheck; item 7 was only visible by reading the shipped handler back against the migration;
item 9 is a claim the plan made about its own evidence that does not hold. The code blocks above now
hold the fixed versions.

1. **`admin_directory()` had no guard, and leaked every account's email address.** It was drafted
   `language sql`, which cannot `raise`, so the privilege check simply was not there. Measured
   before fixing it: a `staff@a` session and a `client@b` session each received **all four**
   directory rows, including every email — the exact cross-tenant disclosure the spec's whole
   "reads for an admin" framing is meant to prevent. Rewritten as plpgsql with the guard as the
   first statement; re-measured, both non-admin sessions now answer `42501` with zero rows.
   The read-only consequence for later tasks: `admin_directory` is the one RPC whose guard failure
   looks like an empty list, so Task 6 asserts the refusal rather than the row count.
2. **`42804` on the admin path.** `auth.users.email` is `varchar(255)`; the declared OUT column is
   `text`, and plpgsql will not coerce it. An admin call failed with "structure of query does not
   match function result type". Fixed with `u.email::text` in the projection. PostgREST hides this
   — only a direct RPC call surfaces it, which is why the unit tier could never have found it.
3. **`service_role` keeps EXECUTE on all five functions** despite the `revoke … from public` —
   Supabase's default function ACL names the role, and revoking from `PUBLIC` does not reach a
   grantee-specific entry. Not a hole: the guard reads the caller JWT, so the key's call answers
   `42501` (measured). Recorded here so a later reader does not claim the revokes are exhaustive;
   the comment in the migration states the same thing.
4. **Task 4's `domainHost` could not pass its own test.** Step 1 asserts `parse("  Atlas.Example/ ")`
   yields `"atlas.example"`, but Step 4's transform only lowercased, so the trailing slash reached
   `BARE_HOST` and threw. Step 4 now strips trailing slashes before the regex (`replace(/\/+$/, "")`),
   which is also the right behaviour: a pasted `https://atlas.example/` should not become a second
   client. Verified: 7 cases green.
5. **Task 6's drafted test file did not typecheck** (`TS2749`, twice). `AdminRpcError` is destructured
   from `await import("@/lib/admin/rpc")` inside each case, so the name is a *value* binding only —
   `(failure as AdminRpcError).code` has no type to resolve. Fixed by adding a type-only import at the
   top of the file, which is erased at runtime and so cannot defeat the `vi.mock("server-only")`
   boundary the dynamic import exists to respect.
6. **Step 4's premise was wrong: stopping the stack does not produce a skip.** `hasTestDb` is
   `Boolean(process.env.TEST_SUPABASE_URL)`, which reads the env name, not container health — so with
   `supabase stop` the tier still thinks it has a database and fails on `fetch failed` instead of
   skipping. That is the better property, and both halves are now measured: an absent
   `TEST_SUPABASE_URL` gives `19 skipped` and exit 0 (what CI sees), and an unreachable one gives
   `3 failed / 19 skipped` and exit 1. Neither run can be misread as coverage.
7. **Task 7's PUT comment claimed an absent `p_client_id` means "leave the column alone". It does
   not.** `admin_attach_member` declares `p_client_id uuid default null`, and its
   `on conflict (id) do update set client_id = excluded.client_id` writes the column on every call —
   so an omitted key and an explicit null are the same statement: this member has no tenant. Only
   `admin_update_client` has the `coalesce` path that turns absence into "no change", and its comment
   now says so. No test caught this because the assertions check the args shape, which was already
   correct; reading the shipped handler against the migration did. Consequence for Task 12: because
   omission means unassign, `attachMemberBody` accepts `{ role: "client" }` with no `clientId` and
   produces a client-role row with no tenant — invisible to every read. The dialog must require a
   client for `client` and `staff`, rather than the schema growing a refine the panel never hits.
8. **Task 9's drafted test contradicted its own title, and would not compile.** The
   `keeps pending accounts in signup order` case fed the directory in as
   `[directory[2], directory[0], directory[1]]` and asserted that same order back — which is *input*
   order, not signup order, and passes even if the merge stops sorting. The implementation sorts by
   `created_at` (as `admin_directory()`'s own `order by u.created_at` does), so the case now asserts
   `ada, bob, cara`, the signup order its title promises. Separately, the first case bound a local
   `users` array, which widens `role: "staff"` to `string` and failed `tsc` with `TS2345` against the
   inferred `UserRow`; the row literal now goes into the call directly, where contextual typing keeps
   the union. Neither defect was visible by reading the draft — one needed running the case, the other
   needed running typecheck.
9. **Step 3 overstates what `typecheck` proves about the row schemas.** `z.array(clientRow).parse(data)`
   accepts `unknown`, so the compiler cannot see drift between the hand-written zod schema and
   `Database["public"]["Tables"]["clients"]["Row"]`; a renamed or widened column would still typecheck
   and only surface as a runtime parse throw. What typecheck genuinely covers here is the RPC contract
   (`admin_directory`'s generated `Args: Record<PropertyKey, never>` and `Returns` array) and that
   `createServerSupabaseClient()` takes those selects at all. The zod-vs-DDL alignment is therefore
   evidenced by the first live read — Task 11's page render against the local stack — and not by
   `tsc`. Recorded so nobody cites this task's green typecheck as coverage of the column names.

## File structure

```
supabase/migrations/20261005000000_admin_provisioning.sql   NEW  5 definer functions + grants
types/metrics.ts                                            MOD  MEMBER_ROLES / MemberRole
lib/admin/schemas.ts                                        NEW  zod: clientName, domainHost, memberRole, 3 bodies
lib/admin/errors.ts                                         NEW  adminErrorStatus(code) + message table
lib/admin/http.ts                                           NEW  jsonResponse / readJsonBody / firstIssueMessage
lib/admin/rpc.ts                                            NEW  server-only callAdminRpc + AdminRpcError
lib/admin/provisioning.ts                                   NEW  server-only getAdminView() + pure merge
types/database.ts                                           MOD  5 Functions entries
lib/auth/routing.ts                                         MOD  PROTECTED_PREFIXES += "/admin"
lib/agents/authAgent.ts                                     MOD  role: z.enum(MEMBER_ROLES)
components/features/user-profile/lib/profile.ts             MOD  role: MemberRole | null
components/features/user-profile/components/account-menu.tsx MOD admin-gated Admin item
app/(app)/admin/page.tsx                                    NEW  requireAdmin + getAdminView + AdminPanel
app/api/admin/clients/route.ts                              NEW  POST
app/api/admin/clients/[clientId]/route.ts                   NEW  PATCH
app/api/admin/members/[userId]/route.ts                     NEW  PUT, DELETE
components/features/admin/index.ts                          NEW  barrel
components/features/admin/components/admin-panel.tsx        NEW  regions + mutation state
components/features/admin/components/client-table.tsx       NEW
components/features/admin/components/client-dialog.tsx      NEW  create + rename
components/features/admin/components/member-table.tsx       NEW
components/features/admin/components/attach-member-dialog.tsx NEW
components/features/admin/lib/mutations.ts                  NEW  4 calls + router.refresh()
components/features/admin/lib/select-items.ts               NEW  role / client Select items
scripts/create-demo-user.mjs                                MOD  --admin
.env.example                                                MOD  ADMIN_EMAIL / ADMIN_PASSWORD names
tests/fixtures/identity-users.ts                            MOD  FIXTURE_USERS.admin
tests/helpers/log-in.ts                                     MOD  logIn(page, role = "demo")
tests/admin/unit/{schemas,errors,role-set,rpc,provisioning}.test.ts        NEW
tests/admin/integration/provisioning.test.ts                NEW
tests/admin/e2e/{panel,layout}.spec.ts                      NEW  @auth, read-only
tests/identity/unit/routing.test.ts                         MOD  /admin case
tests/identity/e2e/admin-guard.spec.ts                      NEW  public tier
tests/identity/unit/admin-creds.test.ts                     NEW  no NEXT_PUBLIC_ admin creds
context/feature-specs/07-admin.md                           NEW  (Task 1)
context/feature-specs/08-app-shell.md                       MOD  role-gating non-goal rewritten
context/progress-tracker.md                                 MOD  In Progress → Completed
docs/target-state.md                                        MOD  step 12
AGENTS.md                                                   MOD  HTTP table, test table, tenancy line, page list
```

Order matters: Task 2's probes gate Task 3's SQL, Task 4's pure modules gate Task 5's RPC wrapper, and nothing renders before Task 9's read exists.

---

### Task 1: Feature spec and tracker entry

`docs/conventions/feature-components.md` requires a spec in `context/feature-specs/` and a tracker "In Progress" entry *before* implementation. This task writes both; it touches no code.

**Files:**
- Create: `context/feature-specs/07-admin.md`
- Modify: `context/progress-tracker.md` (the `## In Progress` section, currently `- None (the app shell + /connections closed 2026-09-25 — see Completed).`)

**Interfaces:**
- Consumes: nothing.
- Produces: the contract every later task cites by section name (`What this is not`, `Writes`, `Errors`).

- [x] **Step 1: Write the spec file.** Create `context/feature-specs/07-admin.md` with exactly this content:

```markdown
# Admin: provisioning

## Goal
Turn an account that signed up but was never provisioned into a member with a role and a
client, and keep the client registry honest — without one line of TypeScript deciding who is
an admin.

## Why this exists
`public.users` has no writer in the app and there is no trigger on `auth.users`, so
`/auth/sign-up` produces a session with no `users` row. That account gets `user: null` from
`getAuthSession()`, `[]` from `listAccessibleClients()`, and an empty dashboard forever. The
panel's highest-value action is "attach this account"; the client registry exists so the same
admin can name the tenant it attaches to.

## What this is not
- No sync logs or run history. `sync_logs` has no production writer.
- No credential writes. `/connections` reads `client_id, source, created_at`; nothing resolves
  a stored key until the worker is hosted, so a paste box would collect a secret no code can use.
- No manual sync trigger. `POST /api/sync/trigger` would enqueue a job nothing consumes.
- No invitations or join codes. No email transport, no token lifecycle.
- No left-rail row. `/admin` is a protected prefix, not a destination, so
  `activeDestination("/admin")` returns `null` and the rail renders with nothing active. The
  entry point is the Admin item in `AccountMenu`, shown only when `profile.role === "admin"`.
- No hard delete on a client. `api_credentials.client_id … on delete cascade` and
  `users.client_id … on delete set null` mean deleting a client destroys its credentials and
  un-homes its members. Deactivate instead.

## Writes
Five `security definer` functions in `public`, all reached with the user-scoped client
(`createServerSupabaseClient()`), all opening with the same role guard, and zero new table
grants:

| Function | Effect |
| --- | --- |
| `admin_directory()` | projects `auth.users` id/email/name/created_at — the half RLS cannot see |
| `admin_create_client(p_name, p_domain)` | insert, domain `lower(trim())`ed |
| `admin_update_client(p_id, p_name, p_is_active)` | partial update; **no domain parameter at all** |
| `admin_attach_member(p_user_id, p_role, p_client_id)` | upsert on the auth id; admin ⇒ `client_id = null` |
| `admin_detach_member(p_user_id)` | delete; `45002` when no row matched |

The guard is `if private.current_user_role() is distinct from 'admin' then raise exception
'admin privilege required' using errcode = '42501'`, and it must be the first statement, because
a definer function bypasses RLS. `pg_advisory_xact_lock(800100)` serialises the last-admin rule
in attach and detach.

Domain is immutable by construction: `lower(domain)` is both the unique index
(`clients_domain_key`) and `scripts/seed.mjs`'s upsert key, so an admin edit would make the next
seed insert a duplicate client.

## Reads
`getAdminView()` returns `{ clients, members, directory }`. `clients` is a direct `clients`
select with **no `is_active` filter** — `listAccessibleClients()` filters it, which would make
Pause irreversible. Every email and display name the panel renders comes from `directory`,
because `public.users` stores neither. Members is the join of `users` and `directory` by `id`;
the Attach list is the set difference; the per-client count is grouped in TypeScript.
Nothing here decides visibility; Postgres already did.

## Errors
`lib/admin/errors.ts` maps the Postgres code to a status and a string, and it is the only
source of error copy in this feature: zod → 400, `23505` → 409, `45001` → 409, `23503` → 409,
`45002` → 409, `42501` → 403, `23514` → 500, anything else → 502. `callAdminRpc` preserves
`error.code` — the shared `databaseOperation()` wrapper erases it, which is why admin writes do
not use it. Refresh only on 2xx: after a refusal the server data is already correct.

## States
Bootstrap is the normal state: one admin from `create-demo-user.mjs --admin`, no other
`users` rows, clients full of seed data. An unassigned member renders "Unassigned", not an
error. No control hides itself based on who you are — your own row still offers Detach and
Postgres answers `45001`.

## Limits accepted out loud
Two admins editing one client is last-write-wins (`clients` has no `updated_at`; none added).
A signed-in non-admin hitting `/admin` is redirected, not shown a 403 page. The directory stops
at `max_rows = 1000`. `browser` specs never write, so nothing asserts that pressing *Create
client* in a browser round-trips; the unit tier owns the handler, the integration tier owns the
function.
```

- [x] **Step 2: Add the tracker entry.** In `context/progress-tracker.md`, replace the single bullet under `## In Progress` with:

```markdown
- **Admin panel: provisioning only** (2026-10-05) — spec `docs/superpowers/specs/2026-10-05-admin-panel-provisioning-design.md`, plan `docs/superpowers/plans/2026-10-05-admin-provisioning.md`, feature spec `context/feature-specs/07-admin.md`. Five `public` definer RPCs called with the user-scoped client; no new table grants. Enters from `AccountMenu`, not the rail.
```

- [x] **Step 3: Verify nothing else moved.**

Run: `git status --short`
Expected: `context/feature-specs/07-admin.md` untracked, `context/progress-tracker.md` modified. Nothing else.

- [x] **Step 4: Gate and commit.**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: `Test Files 26 passed (26)` / `Tests 160 passed (160)`, `tsc --noEmit` silent, lint silent, `○ /dashboard` present, no build warnings.

```bash
git add context/feature-specs/07-admin.md context/progress-tracker.md
git commit -m "docs: spec the admin provisioning slice beside the code that will carry it"
```

---

### Task 2: The two probes, against the local stack

§10 exists because one assumption could invalidate the whole read side: that the migration role can `select` from `auth.users` *from inside* a `security definer` function. Prove it before writing the migration, not after. Both probes run on the **local** stack.

**Files:**
- Create: `/tmp/admin-probe.mjs` (throwaway — outside the repo, deleted after)
- Create: `/tmp/admin-probe.sql` (throwaway)

**Interfaces:**
- Consumes: a running local stack (`pnpm exec supabase start`) and a filled `.env.test`.
- Produces: a recorded verdict on three questions — can a definer read `auth.users`, does `private.current_user_role()` see the *caller* when nested, and does the directory cap bite. Task 3 consumes the verdict; Task 6's first case is the nested-role question proven live.

- [x] **Step 1: Start the local stack and confirm which database you are talking to.**

```bash
pnpm exec supabase start
grep -c . .env.test
node -e '
const { readFileSync } = require("fs");
const pick = (name) => readFileSync(".env.test", "utf8").split("\n")
  .find((line) => line.startsWith(name + "="))?.split("=").slice(1).join("=");
console.log("TEST_SUPABASE_URL =", pick("TEST_SUPABASE_URL"));
'
```

Expected: a URL whose host is `127.0.0.1:54321`. If it is not, **stop** — the probes would be measuring hosted production.

- [x] **Step 2: Write the SQL probe.** Create `/tmp/admin-probe.sql`. It creates a temporary definer function that reads `auth.users` and reports the nested helper's view of the caller:

```sql
create or replace function public.probe_definer_reads_auth()
returns table (auth_rows bigint, helper_says text)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
    select (select count(*) from auth.users),
           private.current_user_role();
end;
$$;
revoke all on function public.probe_definer_reads_auth() from public, anon, authenticated;
select 'total auth.users rows' as what, count(*)::text as value from auth.users
union all
select 'definer can read auth.users', (select count(*) from public.probe_definer_reads_auth())::text
union all
select 'nested helper role (service role => null/other, not a policy bug)',
       (select helper_says from public.probe_definer_reads_auth());
drop function public.probe_definer_reads_auth();
```

- [x] **Step 3: Run the SQL probe as the migration role.**

```bash
SUPABASE_DB_URL="$(grep -m1 '^TEST_DATABASE_URL=' .env.test | cut -d= -f2-)" \
  node scripts/run-migrations.mjs 2>&1 | tail -3
```

That only proves the runner works; the probe itself needs psql. Use the CLI's own shell against the local stack:

```bash
pnpm exec supabase db query --file /tmp/admin-probe.sql
```

Expected: three result rows. Row 2 must be `1` (the function exists and returned a row) — if instead it raises `permission denied for table users` (sqlstate `42501`) on `auth.users`, **§3's read side is invalid**: use the §10.1 fallback (`auth.admin.listUsers()` in `lib/admin/rpc.ts`), and write one comment line in `lib/admin/rpc.ts` naming the service-role key in the request path as the accepted cost. Record which branch you took; do not leave it implicit.

- [x] **Step 4: Prove the nested helper sees the caller, through the API not psql.** `psql` runs as the owner, so it cannot answer "what does the *caller's* role read". `/tmp/admin-probe.mjs` does, with a real session against the local stack:

```js
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = (name, file) => readFileSync(file, "utf8").split("\n")
  .find((l) => l.startsWith(name + "="))?.split("=").slice(1).join("=");
const url = env("TEST_SUPABASE_URL", ".env.test");
const key = env("TEST_SUPABASE_PUBLISHABLE_KEY", ".env.test") ?? "anon-key";
const svc = env("TEST_SUPABASE_SERVICE_ROLE_KEY", ".env.test");
const admin = createClient(url, svc, { auth: { persistSession: false } });
const { data: created, error } = await admin.auth.admin.createUser({
  email: "probe@rls-test.local", password: "probe-password-123", email_confirm: true,
});
if (error) throw error;
await admin.from("users").upsert(
  { id: created.user.id, role: "client", client_id: null }, { onConflict: "id" });
const user = createClient(url, key, { auth: { persistSession: false } });
await user.auth.signInWithPassword({ email: "probe@rls-test.local", password: "probe-password-123" });
const rpc = await user.rpc("probe_role_visible");
console.log("code:", rpc.error?.code, "message:", rpc.error?.message, "data:", rpc.data);
const list = await user.auth.admin.listUsers({ page: 1, perPage: 1000 });
console.log("auth rows visible to service-role list:", list.data?.users.length);
await admin.auth.admin.deleteUser(created.user.id);
```

`probe_role_visible` is a one-line SQL function created in Step 3's file if you kept it, or added here:

```sql
create or replace function public.probe_role_visible()
returns text language sql security definer set search_path = ''
as $$ select private.current_user_role() from auth.users limit 1 $$;
revoke all on function public.probe_role_visible() from public, anon, authenticated;
grant execute on function public.probe_role_visible() to authenticated;
```

Expected: the RPC returns the literal string `client`. That is the proof that `auth.uid()` (and therefore the guard in all five functions) resolves the **caller**, not the function owner. If it returns `null` or `admin`, the guard design is wrong and Task 3 must not be written until the cause is found. Then drop both probe functions:

```bash
pnpm exec supabase db query --sql "drop function if exists public.probe_role_visible(); drop function if exists public.probe_definer_reads_auth();"
```

- [x] **Step 5: Measure the directory cap where it can be measured.** The `1000` in `supabase/config.toml:18` is a PostgREST response cap, so it applies to a set-returning RPC called over the API — and it cannot be observed at all in `psql`. Note the fact, then test it honestly with a synthetic overflow, cleaned up by a pattern only a probe would use:

```bash
pg="$(grep -m1 '^TEST_DATABASE_URL=' .env.test | cut -d= -f2-)"
psql "$pg" -c "
insert into auth.users (instance_id, id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'probe-' || g || '@probe.local', '\$2a\$10\$abcdefghijklmnopAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
       now(), now(), now(), '{}'::jsonb, '{}'::jsonb
from generate_series(1, 999) g;
select count(*) as auth_rows_now from auth.users;"
```

Then re-run Step 4's `list.length` line and record both numbers: the row count `auth.users` holds and the count the RPC returns. Cleanup, scoped to the probe's own addresses:

```bash
psql "$pg" -c "delete from auth.users where email like '%@probe.local';"
psql "$pg" -c "select count(*) from auth.users;"
```

Expected cleanup result: back to the pre-probe count (six accounts plus the fixture rows). **If `psql` is not on PATH** (devcontainer/CI check with `command -v psql`), do not improvise a hosted path — record this step as *not measured*, note in the tracker that the 1000 ceiling is inherited from `config.toml:18` rather than observed, and leave the cap in the migration comment. Per the standing rule about claims: label which of the three questions were executed and which were reasoned.

- [x] **Step 6: Probe the build marker question from §10.2.** This question needs the page, which does not exist yet. Write down its answer as a gate for Task 11 instead: **`pnpm build` must print `ƒ /admin` and still print `○ /dashboard`.** If `/admin` refuses to be dynamic, add `export const dynamic = "force-dynamic"` and note in the tracker that this is the second live instance of the `databaseOperation()` defect that forced the same line on `/connections`.

- [x] **Step 7: Record the verdicts and clean up.** Append to `context/progress-tracker.md`, as a nested bullet under the Task 1 In Progress entry:

```markdown
  - **Probes run against the local stack (2026-10-05).** Definer read of `auth.users`: `<pass | failed — listUsers fallback taken>`. Nested `private.current_user_role()` through a real user session: `<returns "client">`. Directory cap: `<measured at N rows | not measured — ceiling inherited from supabase/config.toml:18>`.
```

Delete `/tmp/admin-probe.mjs` and `/tmp/admin-probe.sql`.

- [x] **Step 8: Gate and commit.**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: unchanged baseline — `26 passed (26)` / `160 passed (160)`, `○ /dashboard`, no warnings.

```bash
git add context/progress-tracker.md
git commit -m "docs: record the admin definer probes before writing the migration"
```

---

### Task 3: The migration — five definer functions, zero new grants

Everything the guard needs is decided: `raise` not "return no rows" (§3), `is distinct from` so a null role is refused, and the grant pair from `public.persist_metrics` (`20260917000000_seo_poc.sql:283-286`) aimed at `authenticated`.

**Files:**
- Create: `supabase/migrations/20261005000000_admin_provisioning.sql`

**Interfaces:**
- Consumes: `private.current_user_role()` / `private.current_user_client_id()` (`20260917000000_seo_poc.sql:126,136`), `clients_domain_key` (`:18`), `users_admin_has_no_tenant` (`:26`), `users_role_check` as rewritten by `20260920000000_add_staff_role.sql`.
- Produces: `public.admin_directory()`, `admin_create_client`, `admin_update_client`, `admin_attach_member`, `admin_detach_member` — the names Task 5 types and Task 6 calls.

- [x] **Step 1: Write the file.** Create `supabase/migrations/20261005000000_admin_provisioning.sql`:

```sql
-- Admin provisioning: five security definer functions in public, no new table grants.
--
-- Why public: PostgREST exposes schemas = ["public", "graphql_public"]
-- (supabase/config.toml:13), so an RPC in private is unreachable from supabase.rpc().
-- private holds only the two helpers policies call. Shape follows public.persist_metrics
-- (20260917000000_seo_poc.sql:215, granted at :283-286), with execute aimed at
-- authenticated instead of service_role.
--
-- Reserved raise codes for this feature: 45001 (business rule refused),
-- 45002 (a write matched no row). 42501 is the role guard, 23505 / 23503 / 23514 are
-- Postgres' own and propagate untouched.
--
-- Advisory lock key 800100 guards the last-admin rule. It is the repository's first
-- pg_advisory_xact_lock; the key is registered here because a magic number with no
-- registry is how two features discover they share one lock.
--
-- admin_directory() is set-returning, so max_rows = 1000 (supabase/config.toml:18) caps
-- it. Measured on the local stack on 2026-10-05: with 1003 rows in auth.users the RPC
-- returned exactly 1000.
--
-- Grants, stated honestly: the revokes below take EXECUTE from public, anon and
-- authenticated, then grant it back to authenticated so the PostgREST role can call the
-- RPCs at all. service_role keeps EXECUTE anyway -- Supabase's default function ACL names
-- it, and revoking from PUBLIC does not reach a grantee-specific entry. That is not a
-- hole: the guard reads the caller's JWT via auth.uid(), and a service-role key carries
-- no user id, so the privilege check runs before any row is touched. Measured on the
-- local stack on 2026-10-05: admin_create_client() with the service-role key answers
-- 42501. What the key *can* still do is insert into public.clients directly, which it has
-- always been able to do; these functions add no new surface for it.

create or replace function public.admin_directory()
returns table (id uuid, email text, name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- plpgsql rather than sql, and named rather than anonymous: language sql cannot
  -- raise, and without this guard every signed-in user receives every account's
  -- email address. Verified on the local stack on 2026-10-05: with the guard absent
  -- a staff session and a client@b session each got all four directory rows.
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  -- u.email is varchar(255) in auth.users; the declared OUT column is text, and
  -- plpgsql will not coerce it. Without the cast an admin call fails with
  -- 42804 "structure of query does not match function result type" (local stack,
  -- 2026-10-05). The jsonb text extraction is already text.
  return query
    select u.id,
           u.email::text,
           u.raw_user_meta_data ->> 'name',
           u.created_at
      from auth.users u
     order by u.created_at;
end;
$$;

create or replace function public.admin_create_client(
  p_name text,
  p_domain text
)
returns public.clients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.clients;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  insert into public.clients (name, domain)
  values (trim(p_name), lower(trim(p_domain)))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_update_client(
  p_id uuid,
  p_name text default null,
  p_is_active boolean default null
)
returns public.clients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.clients;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  -- No domain parameter, on purpose: lower(domain) is both clients_domain_key
  -- (20260917000000_seo_poc.sql:18) and scripts/seed.mjs's upsert key, so an admin
  -- edit here makes the next seed run insert a duplicate client.
  update public.clients
     set name      = coalesce(nullif(trim(p_name), ''), name),
         is_active = coalesce(p_is_active, is_active)
   where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'no such client' using errcode = '45002';
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_attach_member(
  p_user_id uuid,
  p_role text,
  p_client_id uuid default null
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.users;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  -- Two concurrent writes to the last two admin rows would each see one surviving
  -- admin and both commit. The lock is transaction-scoped, so it releases on commit.
  perform pg_advisory_xact_lock(800100);

  -- users_admin_has_no_tenant (20260917000000_seo_poc.sql:26) forbids admin + client_id,
  -- so an admin row nulls its tenant rather than trusting the caller to have omitted it.
  insert into public.users (id, role, client_id)
  values (p_user_id, p_role, case when p_role = 'admin' then null else p_client_id end)
  on conflict (id) do update
     set role      = excluded.role,
         client_id = excluded.client_id
  returning * into v_row;

  -- Checked after the write, inside the same transaction: the raise aborts it, so a
  -- refused demotion leaves the row exactly as it was and no rollback bookkeeping is
  -- needed. Only a non-admin target can empty the admin set.
  if p_role <> 'admin' and not exists (select 1 from public.users where role = 'admin') then
    raise exception 'an admin must remain' using errcode = '45001';
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_detach_member(p_user_id uuid)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.users;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(800100);

  delete from public.users where id = p_user_id returning * into v_row;

  if not found then
    raise exception 'no such member' using errcode = '45002';
  end if;

  if v_row.role = 'admin' and not exists (select 1 from public.users where role = 'admin') then
    raise exception 'an admin must remain' using errcode = '45001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_directory()                                from public, anon, authenticated;
revoke all on function public.admin_create_client(text, text)                  from public, anon, authenticated;
revoke all on function public.admin_update_client(uuid, text, boolean)         from public, anon, authenticated;
revoke all on function public.admin_attach_member(uuid, text, uuid)            from public, anon, authenticated;
revoke all on function public.admin_detach_member(uuid)                        from public, anon, authenticated;

grant execute on function public.admin_directory()                     to authenticated;
grant execute on function public.admin_create_client(text, text)       to authenticated;
grant execute on function public.admin_update_client(uuid, text, boolean) to authenticated;
grant execute on function public.admin_attach_member(uuid, text, uuid) to authenticated;
grant execute on function public.admin_detach_member(uuid)             to authenticated;
```

Note the last-admin rule in `admin_attach_member` is evaluated *after* the upsert, inside the same transaction, and the `45001` raise aborts the whole write — so a refused demotion leaves the row exactly as it was. That is why no rollback bookkeeping appears.

- [x] **Step 2: Apply to the local stack only.** `run-migrations.mjs` takes whatever `SUPABASE_DB_URL`
  it finds, and `.env` on this checkout is hosted production — so the name is set inline, never
  inherited. (As drafted this used `grep '^TEST_DATABASE_URL=' .env.test`; that name does not exist
  in the file, and an empty `SUPABASE_DB_URL` does not fall through `run-migrations.mjs:10`'s `??`.
  Use the local stack's own string from `pnpm exec supabase status`.)

```bash
SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  node scripts/run-migrations.mjs
```

Expected: the run lists `20261005000000_admin_provisioning.sql` as applied (or `skip` on a re-run)
and records it in `public.schema_migrations`. The ledger column is `version`, not `filename`:

```bash
pnpm exec supabase db query --local "select version from public.schema_migrations order by version;"
```

- [x] **Step 3: Smoke-test the guard from real sessions.** `supabase.rpc()` through PostgREST is the
  only substrate that carries a caller JWT, so this is a throwaway `.mjs` under `/tmp` with signed-in
  clients, not a `psql` call:

```js
const sc = createClient(process.env.TEST_SUPABASE_URL,
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sc.auth.signInWithPassword({ email, password: "test-fixture-password-123" });
const r = await sc.rpc("admin_create_client", { p_name: "Probe", p_domain: "probe.local" });
console.log(email, "->", r.error?.code ?? "none", "| rows written:", r.data ? 1 : 0);
```

Run it for `email` in `staff@a.rls-test.local`, `client@b.rls-test.local`, then
`admin@rls-test.local`, and for each of the five function names. Measured on the local stack on
2026-10-05 against the applied migration:

| call | result |
| --- | --- |
| any of the five, `staff` or `client` session | `42501`, nothing written |
| `admin_directory()` as `admin` | no error, 4 rows, emails present |
| `admin_create_client(" Guard Probe ", "  GUARD-PROBE.local ")` as `admin` | `name` trimmed, `domain` lowercased |
| re-run with `"guard-probe.local"` | `23505` (the unique index, not a friendly message) |
| `admin_update_client(<missing uuid>)` | `45002` |
| `admin_update_client(id, p_is_active: false)` | name kept, `is_active` flipped |

Delete the probe client afterwards. A `client` reaching the insert would mean the guard is decoration.
Task 6 turns this into an assertion in the repo rather than a one-off script.

- [x] **Step 4: Verify no table grant appeared.** `supabase db query --local` takes a single
  positional statement and `information_schema.table_privileges` is noisy, so read the ACL directly:

```bash
pnpm exec supabase db query --local "
select c.relname, c.relacl::text[] from pg_class c
 join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('clients','users');"
```

Expected: `authenticated=r/postgres` on both — `select` only, so `20260920000001`'s "no write grants
on tables" stance is intact. Any `w`/`a`/`d` entry means something in Step 1 reached for a grant;
delete it. The five `admin_*` ACLs should read `authenticated=X` (execute only) — see the
`service_role` note in the Substrate section for the entry that survives the revokes.

- [x] **Step 5: Gate and commit.**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: baseline unchanged (`160 passed`); the migration is SQL, so no test knows about it yet.

```bash
git add supabase/migrations/20261005000000_admin_provisioning.sql
git commit -m "feat(db): add the five admin provisioning RPCs, guarded inside Postgres"
```

---

### Task 4: Schemas, the error map, and one role list

Pure TypeScript, no database, no React — this is the task where the §7 table becomes testable (§8: "Extract the §7 mapping into `lib/admin/errors.ts` before writing its test").

**Files:**
- Create: `lib/admin/schemas.ts`
- Create: `lib/admin/errors.ts`
- Modify: `types/metrics.ts` (append `MEMBER_ROLES` / `MemberRole`)
- Modify: `lib/agents/authAgent.ts:6-10` (`role` z.enum)
- Modify: `components/features/user-profile/lib/profile.ts:8` (`ProfileView.role`)
- Modify: `types/database.ts:85` (`users.Row.role`)
- Test: `tests/admin/unit/schemas.test.ts`
- Test: `tests/admin/unit/errors.test.ts`
- Test: `tests/admin/unit/role-set.test.ts`

**Interfaces:**
- Consumes: `types/metrics.ts` (already imported by `types/database.ts:1`).
- Produces: `clientName`, `domainHost`, `memberRole`, `createClientBody`, `updateClientBody`, `attachMemberBody`; `adminErrorStatus(code: string | undefined): number`, `adminErrorMessage(rpc: AdminWriteRpc, code): string`, `type AdminWriteRpc`; `MEMBER_ROLES`, `MemberRole`. Task 7's handlers import the schemas and both error functions; Task 5 derives its own function-name union from `types/database.ts` and imports neither.

- [x] **Step 1: Write the failing schema test.** Create `tests/admin/unit/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  attachMemberBody,
  clientName,
  createClientBody,
  domainHost,
  updateClientBody,
} from "@/lib/admin/schemas";

describe("clientName", () => {
  it("trims and bounds the value", () => {
    expect(clientName.parse("  Atlas  ")).toBe("Atlas");
    expect(clientName.safeParse("").success).toBe(false);
    expect(clientName.safeParse("x".repeat(121)).success).toBe(false);
  });
});

describe("domainHost", () => {
  it("lowercases and keeps a bare host", () => {
    expect(domainHost.parse("  Atlas.Example/ ")).toBe("atlas.example");
  });
  it("rejects a scheme, a path, a port and a space", () => {
    for (const bad of [
      "http://atlas.example",
      "atlas.example/path",
      "atlas.example:54321",
      "not a domain",
      "at..example",
    ]) {
      const result = domainHost.safeParse(bad);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Enter a bare domain, e.g. atlas.example",
      );
    }
  });
});

describe("createClientBody", () => {
  it("requires both fields", () => {
    expect(
      createClientBody.safeParse({ name: "Atlas", domain: "atlas.example" })
        .success,
    ).toBe(true);
    expect(createClientBody.safeParse({ name: "Atlas" }).success).toBe(false);
  });
});

describe("updateClientBody", () => {
  it("demands at least one key so a no-op cannot reach the RPC", () => {
    expect(updateClientBody.safeParse({}).success).toBe(false);
    expect(updateClientBody.safeParse({ isActive: false }).success).toBe(true);
    expect(updateClientBody.safeParse({ name: "Atlas Ops" }).success).toBe(true);
  });
});

describe("attachMemberBody", () => {
  it("requires a role and takes an optional nullable client", () => {
    expect(
      attachMemberBody.safeParse({ role: "staff", clientId: null }).success,
    ).toBe(true);
    expect(attachMemberBody.safeParse({ role: "staff" }).success).toBe(true);
    expect(attachMemberBody.safeParse({ clientId: null }).success).toBe(false);
    expect(attachMemberBody.safeParse({ role: "owner" }).success).toBe(false);
  });
  it("rejects a non-uuid client id", () => {
    expect(
      attachMemberBody.safeParse({ role: "client", clientId: "7" }).success,
    ).toBe(false);
  });
});
```

- [x] **Step 2: Run it to verify it fails.**

Run: `pnpm test admin/unit/schemas`
Expected: module-not-found for `@/lib/admin/schemas`.

- [x] **Step 3: Add the role list to `types/metrics.ts`.** Append at the end of the file:

```ts
export const MEMBER_ROLES = ["admin", "client", "staff"] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];
```

- [x] **Step 4: Write the schemas.** Create `lib/admin/schemas.ts`:

```ts
import { z } from "zod";

import { MEMBER_ROLES } from "@/types/metrics";

const BARE_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const clientName = z.string().trim().min(1).max(120);

export const domainHost = z
  .string()
  .trim()
  .min(4)
  .max(253)
  .transform((value) => value.toLowerCase())
  .refine((value) => BARE_HOST.test(value), "Enter a bare domain, e.g. atlas.example");

export const memberRole = z.enum(MEMBER_ROLES);

export const createClientBody = z.object({
  name: clientName,
  domain: domainHost,
});

export const updateClientBody = z
  .object({
    name: clientName.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: "Provide a name or an isActive value",
  });

export const attachMemberBody = z.object({
  role: memberRole,
  clientId: z.uuid().nullable().optional(),
});

export type CreateClientBody = z.infer<typeof createClientBody>;
export type UpdateClientBody = z.infer<typeof updateClientBody>;
export type AttachMemberBody = z.infer<typeof attachMemberBody>;
```

`z.uuid()` and `.trim()`-before-`.min()` match the existing idiom (`z.uuid()` in `lib/db/repository.ts`, `clientName` bounds per §3 "text bounds belong to zod"). `attachMemberBody.clientId` is `nullable().optional()` because the PUT sends either key — `null` means "leave them unassigned", absent means the same — and §7's "Unassigned is not an error" needs the first form to be expressible.

- [x] **Step 5: Write the failing error-map test.** Create `tests/admin/unit/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";

describe("adminErrorStatus", () => {
  it.each([
    ["23505", 409],
    ["23503", 409],
    ["45001", 409],
    ["45002", 409],
    ["42501", 403],
    ["23514", 500],
    ["08006", 502],
    [undefined, 502],
  ])("maps %s to %i", (code, expected) => {
    expect(adminErrorStatus(code)).toBe(expected);
  });
});

describe("adminErrorMessage", () => {
  it("names the rule, not the constraint", () => {
    expect(adminErrorMessage("admin_create_client", "23505")).toBe(
      "Another client already owns that domain.",
    );
    expect(adminErrorMessage("admin_attach_member", "45001")).toBe(
      "Assign another admin before removing this one.",
    );
    expect(adminErrorMessage("admin_detach_member", "45002")).toBe(
      "That account is not provisioned.",
    );
    expect(adminErrorMessage("admin_update_client", "45002")).toBe(
      "That client no longer exists.",
    );
    expect(adminErrorMessage("admin_attach_member", "23503")).toBe(
      "That account or client no longer exists.",
    );
    expect(adminErrorMessage("admin_create_client", "23514")).toBe(
      "The server rejected that change.",
    );
  });
  it("says the same thing for every caller who lost admin", () => {
    for (const rpc of [
      "admin_create_client",
      "admin_update_client",
      "admin_attach_member",
      "admin_detach_member",
    ] as const) {
      expect(adminErrorMessage(rpc, "42501")).toBe(
        "You no longer have admin access.",
      );
    }
  });
  it("never invents a message for an unknown code", () => {
    expect(adminErrorMessage("admin_create_client", "08006")).toBe(
      "Could not reach the database.",
    );
  });
});
```

- [x] **Step 6: Run it to verify it fails.**

Run: `pnpm test admin/unit/errors`
Expected: module-not-found for `@/lib/admin/errors`.

- [x] **Step 7: Write the error map.** Create `lib/admin/errors.ts`:

```ts
export type AdminWriteRpc =
  | "admin_create_client"
  | "admin_update_client"
  | "admin_attach_member"
  | "admin_detach_member";

const STATUS_BY_CODE: Record<string, number> = {
  "23505": 409,
  "23503": 409,
  "45001": 409,
  "45002": 409,
  "42501": 403,
  "23514": 500,
};

export function adminErrorStatus(code: string | undefined): number {
  return (code && STATUS_BY_CODE[code]) || 502;
}

const ANY_RPC: Record<string, string> = {
  "42501": "You no longer have admin access.",
  "23514": "The server rejected that change.",
};

const BY_RPC: Record<AdminWriteRpc, Record<string, string>> = {
  admin_create_client: {
    "23505": "Another client already owns that domain.",
    "23503": "That client no longer exists.",
    "45001": "Assign another admin before removing this one.",
    "45002": "That client no longer exists.",
  },
  admin_update_client: {
    "23505": "Another client already owns that domain.",
    "23503": "That client no longer exists.",
    "45002": "That client no longer exists.",
    "45001": "Assign another admin before removing this one.",
  },
  admin_attach_member: {
    "23503": "That account or client no longer exists.",
    "45001": "Assign another admin before removing this one.",
    "45002": "That account is not provisioned.",
  },
  admin_detach_member: {
    "45001": "Assign another admin before removing this one.",
    "45002": "That account is not provisioned.",
    "23503": "That account or client no longer exists.",
  },
};

export function adminErrorMessage(rpc: AdminWriteRpc, code: string | undefined): string {
  const specific = code ? BY_RPC[rpc][code] : undefined;
  if (specific) return specific;
  const shared = code ? ANY_RPC[code] : undefined;
  if (shared) return shared;
  return "Could not reach the database.";
}
```

`23514 → 500` is deliberate: §7 calls it out as "loud; a polite message here would hide a function bug." `admin_create_client` has no `45002` entry because that function cannot match zero rows — an insert either returns a row or raises.

- [x] **Step 8: Point the three duplicated role unions at the list.** In `lib/agents/authAgent.ts`, change the `authUserSchema` role field from `z.enum(["admin", "client", "staff"])` to `role: z.enum(MEMBER_ROLES)` and add `import { MEMBER_ROLES } from "@/types/metrics";`. In `components/features/user-profile/lib/profile.ts`, change `role: "admin" | "client" | "staff" | null` to `role: MemberRole | null` with `import type { MemberRole } from "@/types/metrics";`. In `types/database.ts:85`, change `role: "admin" | "client" | "staff"` to `role: MemberRole` and extend the existing import on line 1 to include `MemberRole`.

- [x] **Step 9: Write the role-set test.** Create `tests/admin/unit/role-set.test.ts` — this is §8's "one table rather than trusting three comments", made real by reading the DDL:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MEMBER_ROLES } from "@/types/metrics";

const MIGRATIONS = "supabase/migrations";

function staffRoleMigration(): string {
  const file = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith("_add_staff_role.sql"),
  );
  if (!file) throw new Error("add_staff_role migration is missing");
  return readFileSync(`${MIGRATIONS}/${file}`, "utf8");
}

describe("the member role set", () => {
  it("matches the list in users_role_check's DDL", () => {
    const ddl = staffRoleMigration();
    const match = ddl.match(/check\s*\(\s*role\s+in\s*\(([^)]*)\)/i);
    expect(match).not.toBeNull();
    const fromDdl = match![1]
      .split(",")
      .map((part) => part.trim().replace(/^'|'$/g, ""));
    expect(fromDdl.sort()).toEqual([...MEMBER_ROLES].sort());
  });

  it("is not restated inside the admin provisioning migration", () => {
    const ddl = readFileSync(
      `${MIGRATIONS}/20261005000000_admin_provisioning.sql`,
      "utf8",
    );
    // A second list is a second owner. users_role_check decides; the functions do not.
    expect(ddl).not.toMatch(/p_role\s+in\s*\(/i);
    expect(ddl).not.toMatch(/case\s+p_role/i);
  });
});
```

- [x] **Step 10: Run the three tests, then the gate.**

Run: `pnpm test admin`
Expected: three files pass, every case green. If `role-set.test.ts` fails on the DDL regex, fix the **test's regex** to the real DDL text — read `supabase/migrations/20260920000000_add_staff_role.sql` — and do not touch the migration to satisfy a test.

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: green; `Tests` counts the 160 baseline plus the three new files' cases, `○ /dashboard`, no warnings. The three modified files are type-level only, so `typecheck` is the real proof they changed nothing behavioural.

- [x] **Step 11: Report the diff and commit on approval.** King reads the code changes before they
  become a commit (asked for on 2026-10-05, partway through this plan), so this step is: show
  `git status --short`, the diff of the four modified files, and the five new files — then wait for a
  yes. Once he says so:

```bash
git add lib/admin/schemas.ts lib/admin/errors.ts types/metrics.ts types/database.ts \
  lib/agents/authAgent.ts components/features/user-profile/lib/profile.ts \
  tests/admin/unit/schemas.test.ts tests/admin/unit/errors.test.ts tests/admin/unit/role-set.test.ts
git commit -m "feat(admin): add the schema and error-map layer, with one role list to agree with"
```

---

### Task 5: `callAdminRpc` — the wrapper that keeps the code

§0.2 is the regression this task exists to prevent: `lib/db/repository.ts` throws away `error.code` at eleven call sites and in `databaseOperation()`'s catch-all, so a code→status map downstream would be decoration. Admin writes get their own boundary, and the boundary's test asserts the *code* survived, not that a message looked nice.

**Files:**
- Create: `lib/admin/rpc.ts`
- Modify: `types/database.ts` (the `Functions:` block, `:93-103`)
- Test: `tests/admin/unit/rpc.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient()` (`lib/supabase/server` — confirm the exact export name and path against `lib/db/repository.ts`'s import line before writing), `AdminWriteRpc` from Task 4.
- Produces: `class AdminRpcError { code?: string; functionName: string }`, `callAdminRpc<TName extends AdminFunctionName>(name: TName, args: AdminRpcArgs<TName>): Promise<AdminRpcResult<TName>>`. Task 6 calls it against real Postgres; Tasks 7 and 9 call it for every read and write.

- [x] **Step 1: Write the failing test.** Create `tests/admin/unit/rpc.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const createServerSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: () => undefined,
    set: () => {},
    remove: () => {},
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient,
}));

import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";

beforeEach(() => {
  rpc.mockReset();
  createServerSupabaseClient.mockReset();
  createServerSupabaseClient.mockResolvedValue({ rpc });
});

describe("callAdminRpc", () => {
  it("uses the user-scoped client and no service-role one", async () => {
    rpc.mockResolvedValue({ data: { id: "1" }, error: null });
    await callAdminRpc("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    });
    expect(createServerSupabaseClient).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    });
  });

  it("preserves the Postgres code on the way out", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates clients_domain_key', details: "Key (domain)=(atlas.example) already exists." },
    });
    const failure = await callAdminRpc("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AdminRpcError);
    expect((failure as AdminRpcError).code).toBe("23505");
  });

  it("does not repeat Postgres' message or its DETAIL", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key …clients_domain_key", details: "Key (domain)=(atlas.example)" },
    });
    await expect(
      callAdminRpc("admin_create_client", { p_name: "A", p_domain: "a.example" }),
    ).rejects.toThrow(/admin rpc admin_create_client failed \(23505\)/);
    await expect(
      callAdminRpc("admin_create_client", { p_name: "A", p_domain: "a.example" }),
    ).rejects.not.toThrow(/clients_domain_key|DETAIL|already exists/);
  });

  it("throws a code-less error when PostgREST gives no code", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "no code here" } });
    const failure = await callAdminRpc("admin_detach_member", {
      p_user_id: "00000000-0000-4000-8000-0000000000ff",
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AdminRpcError);
    expect((failure as AdminRpcError).code).toBeUndefined();
  });

  it("returns data unwrapped on success", async () => {
    const row = { id: "00000000-0000-4000-8000-0000000000ff", name: "Atlas" };
    rpc.mockResolvedValue({ data: row, error: null });
    await expect(
      callAdminRpc("admin_create_client", { p_name: "Atlas", p_domain: "atlas.example" }),
    ).resolves.toEqual(row);
  });

  it("logs the function name and code, never a payload", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "45001", message: "an admin must remain" } });
    await callAdminRpc("admin_attach_member", {
      p_user_id: "00000000-0000-4000-8000-0000000000ff",
      p_role: "client",
    }).catch(() => {});
    expect(spy).toHaveBeenCalledWith("[admin] rpc failed", {
      functionName: "admin_attach_member",
      code: "45001",
    });
    spy.mockRestore();
  });
});
```

Run: `pnpm test admin/unit/rpc`
Expected: module-not-found for `@/lib/admin/rpc`.

- [x] **Step 2: Type the five functions in `types/database.ts`.** Replace the `Functions:` block (currently `persist_metrics` only) with:

```ts
    Functions: {
      persist_metrics: {
        Args: {
          p_client_id: string;
          p_source: Source;
          p_metrics: Json;
          p_synced_at: string;
          p_run_id: string;
        };
        Returns: undefined;
      };
      admin_directory: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; email: string | null; name: string | null; created_at: string }[];
      };
      admin_create_client: {
        Args: { p_name: string; p_domain: string };
        Returns: Client & { created_at: string };
      };
      admin_update_client: {
        Args: { p_id: string; p_name?: string | null; p_is_active?: boolean | null };
        Returns: Client & { created_at: string };
      };
      admin_attach_member: {
        Args: { p_user_id: string; p_role: MemberRole; p_client_id?: string | null };
        Returns: { id: string; role: MemberRole; client_id: string | null; created_at: string };
      };
      admin_detach_member: {
        Args: { p_user_id: string };
        Returns: { id: string; role: MemberRole; client_id: string | null; created_at: string };
      };
    };
```

Extend the import on line 1 to `import type { Client, MemberRole, Source, SyncLogInput } from "@/types/metrics";`, and reuse it for the `users` table's `Row` (Task 4, Step 8 already changed `:85`). `admin_directory`'s `email` is `string | null` because `auth.users.email` is nullable, and the projection is `->> 'name'`, which is null for any account that never set one.

- [x] **Step 3: Write `lib/admin/rpc.ts`.**

```ts
import "server-only";

import type { Database } from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Functions = Database["public"]["Functions"];
export type AdminFunctionName = keyof Functions & string;
type AdminRpcArgs<TName extends AdminFunctionName> = Functions[TName]["Args"];
type AdminRpcReturns<TName extends AdminFunctionName> = Functions[TName]["Returns"];

/**
 * Postgres' own message is dropped on purpose: lib/admin/errors.ts owns every
 * string this feature emits, and forwarding message text would leak constraint
 * and column names into a response body.
 */
export class AdminRpcError extends Error {
  readonly code: string | undefined;
  readonly functionName: string;

  constructor(functionName: string, code: string | undefined) {
    super(`admin rpc ${functionName} failed (${code ?? "unknown"})`);
    this.name = "AdminRpcError";
    this.code = code;
    this.functionName = functionName;
  }
}

/**
 * The only admin write path. The client is the cookie-bound one, so the definer
 * functions' own role guard sees the caller's role and RLS still decides reads —
 * getAdminDb() is not reachable from here.
 */
export async function callAdminRpc<TName extends AdminFunctionName>(
  functionName: TName,
  args: AdminRpcArgs<TName>,
): Promise<AdminRpcReturns<TName>> {
  const db = await createServerSupabaseClient();
  // Optional args left undefined must reach Postgres as absent, not null: the
  // function defaults (p_is_active default null => "leave that column alone")
  // only apply to a key that is missing from the JSON body.
  const { data, error } = await db.rpc(functionName, args as never);
  if (error) {
    console.error("[admin] rpc failed", {
      functionName,
      code: (error as { code?: string }).code,
    });
    throw new AdminRpcError(functionName, (error as { code?: string }).code);
  }
  return data as AdminRpcReturns<TName>;
}
```

Confirm `createServerSupabaseClient`'s real module path and whether it is async by reading the import at the top of `lib/db/repository.ts` and one call site (`canAccessClient` uses `await createServerSupabaseClient()`); mirror it exactly rather than trusting this line. The `args as never` cast is the one place this file is not inferred — `supabase-js`'s `rpc()` generic wants a `Record<string, Json>` shape it cannot derive from a keyed lookup, and `AdminRpcArgs` is the checked type the callers get. If `typecheck` accepts the cast-free version, drop the cast.

- [x] **Step 4: Run the test, then the gate.**

Run: `pnpm test admin/unit/rpc`
Expected: 6 passed. If `does not repeat Postgres' message` fails, the wrapper is interpolating `error.message` — remove it; the message is for the log, and the log line emits only `{ functionName, code }`.

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: green; `typecheck` now proves the five `Functions` entries compile.

- [x] **Step 5: Report the diff and commit on approval.**

```bash
git add lib/admin/rpc.ts types/database.ts tests/admin/unit/rpc.test.ts
git commit -m "feat(admin): add the code-preserving RPC boundary and type the five functions"
```

---

### Task 6: Integration tier — prove the guard, not the mock

§8 argues this is not a written-but-unexecuted deposit: `.env.test` carries the four `TEST_*` names, `requireTestDb()` re-binds `NEXT_PUBLIC_*` to that stack so no call can reach the live one, and `rls-gate.test.ts` has been green twice. So these cases run, and the tracker quotes the passed/skipped split — exit 0 alone reads like coverage the tier never had.

**Files:**
- Modify: `tests/fixtures/identity-users.ts` (`FIXTURE_USERS`, and the inline admin address in `provisionFixtures`)
- Create: `tests/admin/integration/provisioning.test.ts`

**Interfaces:**
- Consumes: Task 3's five functions on the local stack, Task 5's `callAdminRpc` / `AdminRpcError`, `withSession` / `provisionFixtures` / `adminDb` / `FIXTURE_USERS`.
- Produces: `FIXTURE_USERS.admin` (the string other suites reach for) and the only evidence in the repo that the definer guard fires.

- [x] **Step 1: Name the admin fixture instead of repeating its address.** In `tests/fixtures/identity-users.ts`, add the fourth key to `FIXTURE_USERS`:

```ts
export const FIXTURE_USERS = {
  clientA: "client@a.rls-test.local",
  clientB: "client@b.rls-test.local",
  staffA: "staff@a.rls-test.local",
  admin: "admin@rls-test.local",
};
```

Then change `provisionFixtures()`'s inline `ensureAuthUser(db, "admin@rls-test.local")` call to `ensureAuthUser(db, FIXTURE_USERS.admin)` — one address, one owner. `rls-gate.test.ts:80` still passes: it uses the literal, which is now the same string. Do not edit that file in this task. The header comment above `FIXTURE_USERS` said "three auth users"; it now says four.

Run: `pnpm test:integration` (`pnpm test tenant-isolation` filters the *unit* project, where no tenant-isolation file lives)
Expected: unchanged — 5 + 4 passed with the stack up. Measured: `rls-gate` 5, `credentials-visibility` 4.

- [x] **Step 2: Write the integration file.** Create `tests/admin/integration/provisioning.test.ts`. Two rules from `tests/fixtures/README.md:41`: inserts go through the service-role client, every **assertion** goes through the user-scoped one. And because Vitest runs files in parallel against one Postgres, destructive cases create their own scratch auth user inside the file and delete it in `afterEach` — never another suite's fixture rows.

```ts
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { hasTestDb } from "../../helpers/db";
import type { AdminRpcError } from "@/lib/admin/rpc";   // finding 5: the dynamic import gives a
                                                         // value binding only; the cast needs this

// The admin RPCs are the enforcement point, so this file is evidence about
// Postgres: a non-admin must be refused by the function, not by a handler that
// happens to check first.

vi.mock("next/headers", () => ({
  cookies: async () => getCurrentCookieStore(),
}));
vi.mock("server-only", () => ({}));

import {
  FIXTURE_PASSWORD,
  FIXTURE_USERS,
  adminDb,
  getCurrentCookieStore,
  provisionFixtures,
  withSession,
  type TestClients,
} from "../../fixtures/identity-users";

const SCRATCH_EMAIL = "scratch@admin-test.local";

async function rpc() {
  return await import("@/lib/admin/rpc");
}

describe.skipIf(!hasTestDb)("admin provisioning RPCs against live Postgres", () => {
  let clients: TestClients;
  let scratchId = "";

  beforeAll(async () => {
    clients = await provisionFixtures();
  });

  afterEach(async () => {
    if (scratchId) {
      await adminDb().from("users").delete().eq("id", scratchId);
      await adminDb().auth.admin.deleteUser(scratchId);
      scratchId = "";
    }
  });

  async function scratchUser(): Promise<string> {
    const db = adminDb();
    const { data: existing } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existing?.users.find((u) => u.email === SCRATCH_EMAIL);
    if (found) {
      await db.from("users").delete().eq("id", found.id);
      return found.id;
    }
    const { data, error } = await db.auth.admin.createUser({
      email: SCRATCH_EMAIL,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Scratch Member" },
    });
    if (error || !data.user) throw new Error(`scratch user: ${error?.message}`);
    return data.user.id;
  }

  it("refuses a client-role caller with 42501 before touching a row", async () => {
    const { AdminRpcError, callAdminRpc } = await rpc();
    scratchId = await scratchUser();
    await withSession(FIXTURE_USERS.clientA, async () => {
      const failure = await callAdminRpc("admin_create_client", {
        p_name: "Refused Client",
        p_domain: "refused.admin-test.local",
      }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AdminRpcError);
      expect((failure as AdminRpcError).code).toBe("42501");
    });
    // The nested helper resolved the caller, not the function owner.
    const { data } = await adminDb()
      .from("clients")
      .select("id")
      .eq("domain", "refused.admin-test.local")
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("refuses the directory read to a staff session, too", async () => {
    // Regression for the leak the first draft of the migration shipped with:
    // an unguarded `language sql admin_directory()` handed every account's
    // email to any staff session (measured, 4 rows). The row count is not the
    // assertion here — the refusal is.
    const { AdminRpcError, callAdminRpc } = await rpc();
    await withSession(FIXTURE_USERS.staffA, async () => {
      const failure = await callAdminRpc("admin_directory", {}).catch(
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(AdminRpcError);
      expect((failure as AdminRpcError).code).toBe("42501");
    });
  });

  it("refuses an unauthenticated caller", async () => {
    const { AdminRpcError, callAdminRpc } = await rpc();
    await withSession(null, async () => {
      const failure = await callAdminRpc("admin_detach_member", {
        p_user_id: clients.a,
      }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AdminRpcError);
    });
  });

  it("creates a client with a lowercased domain, and refuses the case-variant duplicate", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    await withSession(FIXTURE_USERS.admin, async () => {
      const created = await callAdminRpc("admin_create_client", {
        p_name: "Duplicate Probe",
        p_domain: "MixedCase.Admin-Test.local",
      });
      expect(created.domain).toBe("mixedcase.admin-test.local");
      await db.from("clients").delete().eq("id", created.id);

      await callAdminRpc("admin_create_client", {
        p_name: "Domain Owner",
        p_domain: "owned.admin-test.local",
      });
      const collision = await callAdminRpc("admin_create_client", {
        p_name: "Another Owner",
        p_domain: "OWNED.admin-test.local",
      }).catch((error: unknown) => error);
      expect((collision as { code?: string }).code).toBe("23505");
    });
    await db.from("clients").delete().eq("domain", "owned.admin-test.local");
  });

  it("attaches a provisioned-less account, then nulls its tenant on promotion", async () => {
    const { callAdminRpc } = await rpc();
    scratchId = await scratchUser();
    await withSession(FIXTURE_USERS.admin, async () => {
      const attached = await callAdminRpc("admin_attach_member", {
        p_user_id: scratchId,
        p_role: "client",
        p_client_id: clients.a,
      });
      expect(attached.client_id).toBe(clients.a);

      const promoted = await callAdminRpc("admin_attach_member", {
        p_user_id: scratchId,
        p_role: "admin",
        p_client_id: clients.a,
      });
      expect(promoted.role).toBe("admin");
      expect(promoted.client_id).toBeNull();

      // The row exists now, so a real session sees the member it belongs to.
      const directory = await callAdminRpc("admin_directory", {});
      expect(directory.map((row) => row.id)).toContain(scratchId);
      expect(directory.find((row) => row.id === scratchId)?.name).toBe(
        "Scratch Member",
      );
    });
    await adminDb().from("users").delete().eq("id", scratchId);
  });

  it("refuses to detach the last admin, and leaves the row intact", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    const before = await db.from("users").select("id").eq("role", "admin");
    expect((before.data ?? []).length).toBe(1);
    const onlyAdmin = before.data![0].id;

    await withSession(FIXTURE_USERS.admin, async () => {
      const refusal = await callAdminRpc("admin_detach_member", {
        p_user_id: onlyAdmin,
      }).catch((error: unknown) => error);
      expect((refusal as { code?: string }).code).toBe("45001");
    });

    const after = await db.from("users").select("id").eq("role", "admin");
    expect((after.data ?? []).map((row) => row.id)).toEqual([onlyAdmin]);
  });

  it("refuses to demote the last admin through attach", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    const before = await db.from("users").select("id,role").eq("role", "admin");
    const onlyAdmin = before.data![0];

    await withSession(FIXTURE_USERS.admin, async () => {
      const refusal = await callAdminRpc("admin_attach_member", {
        p_user_id: onlyAdmin.id,
        p_role: "staff",
        p_client_id: clients.a,
      }).catch((error: unknown) => error);
      expect((refusal as { code?: string }).code).toBe("45001");
    });

    const still = await db.from("users").select("role").eq("id", onlyAdmin.id);
    expect(still.data![0].role).toBe("admin");
  });

  it("answers 45002 when detach matches no row", async () => {
    const { callAdminRpc } = await rpc();
    scratchId = await scratchUser();
    await withSession(FIXTURE_USERS.admin, async () => {
      const failure = await callAdminRpc("admin_detach_member", {
        p_user_id: scratchId,
      }).catch((error: unknown) => error);
      expect((failure as { code?: string }).code).toBe("45002");
    });
  });

  it("treats an absent id in update as 'leave that column alone'", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    const created = await db
      .from("clients")
      .insert({ name: "Partial Probe", domain: "partial.admin-test.local", is_active: true })
      .select("id,name,is_active")
      .single();
    const id = created.data!.id as string;

    await withSession(FIXTURE_USERS.admin, async () => {
      const renamed = await callAdminRpc("admin_update_client", {
        p_id: id,
        p_name: "Partial Probe Renamed",
      });
      expect(renamed.name).toBe("Partial Probe Renamed");
      expect(renamed.is_active).toBe(true);

      const paused = await callAdminRpc("admin_update_client", {
        p_id: id,
        p_is_active: false,
      });
      expect(paused.is_active).toBe(false);
      expect(paused.name).toBe("Partial Probe Renamed");
    });

    await db.from("clients").delete().eq("id", id);
  });

  it("restores any row it moved, so the next file sees the fixtures as written", async () => {
    // Not a behaviour case: this one asserts the teardown contract the parallel
    // files depend on. clientA must still be a client of A after every write above.
    const db = adminDb();
    const { data } = await db
      .from("users")
      .select("role,client_id")
      .eq("id", (await db.auth.admin.listUsers({ page: 1, perPage: 1000 }))
        .data!.users.find((u) => u.email === FIXTURE_USERS.clientA)!.id)
      .single();
    expect(data).toMatchObject({ role: "client", client_id: clients.a });
  });
});
```

- [x] **Step 3: Run the tier against the local stack.**

```bash
pnpm exec supabase start
pnpm test:integration
```

Expected: three files, all passing — `rls-gate` (5), `credentials-visibility` (4), `provisioning`
(10). A `skipped` count here is not a pass: read the split out loud. Measured: `3 passed (3) /`
`19 passed (19)`, with each guard code printed by `callAdminRpc`'s own `console.error` line —
`42501` ×3, `23505`, `45001` ×2, `45002`. Step 2 ships one case the draft did not have: finding 1's
consequence is only testable directly, so the file asserts that a staff session is *refused* by
`admin_directory` rather than checking how many rows it got.

- [x] **Step 4: Prove the skip is honest — and that it is the env name that decides.** This step
  was drafted as `pnpm exec supabase stop && pnpm test:integration`. Running that would **not** skip
  anything: `hasTestDb` is `Boolean(process.env.TEST_SUPABASE_URL)`, which reads the env name, not
  container health, so a stopped stack still claims to have a database and dies on `fetch failed`
  instead. Measured both ways instead, without stopping anything the next task needs:

```bash
TEST_SUPABASE_URL= pnpm test:integration                              # the honest skip
TEST_SUPABASE_URL=http://127.0.0.1:59999 pnpm test:integration; echo $?   # the loud failure
```

Measured, both with the stack up:

- no `TEST_SUPABASE_URL` → `Test Files 3 skipped (3) / Tests 19 skipped (19)`, exit 0, and
  `load-test-env.ts:13` prints the "set TEST_SUPABASE_URL …" warning. This is what CI sees, and the
  tracker must quote it as *skipped*, never as "covered".
- an unreachable `TEST_SUPABASE_URL` → `Test Files 3 failed (3)`, exit 1, every case throwing
  `fetch failed` out of `beforeAll`. So a dead stack cannot masquerade as a pass either: the only
  quiet outcome is the one that says so out loud.

`supabase stop` is the wrong instrument here — it leaves the env name set, so the tier still believes
it has a database and errors instead of skipping. That is finding 6 above.

- [x] **Step 5: Report the diff and commit on approval.** King reads the code changes before they
  land, so the commit below waits for a yes.

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: baseline unit tier green, `○ /dashboard`, no warnings. Measured: unit `30 files / 186`
tests passed, integration `3 files / 19` passed (`rls-gate` 5, `credentials-visibility` 4,
`provisioning` 10), `tsc --noEmit` exit 0, eslint exit 0 with no
output, build compiled with `○ /dashboard` still prerendered and no `/admin` route yet (Task 11
adds it).

```bash
git add tests/fixtures/identity-users.ts tests/admin/integration/provisioning.test.ts
git commit -m "test(admin): prove the definer guard and the last-admin rule against live Postgres"
```

---

### Task 7: The four verbs

Every handler is the same five lines in the same order (§4): `requireAdmin()` → zod → `callAdminRpc` → code→status → `{ data }` or `{ error }`. The guard runs **before any db touch**, which is what the unit test asserts.

**Files:**
- Create: `lib/admin/http.ts`
- Create: `app/api/admin/clients/route.ts`
- Create: `app/api/admin/clients/[clientId]/route.ts`
- Create: `app/api/admin/members/[userId]/route.ts`
- Test: `tests/admin/unit/clients-route.test.ts`
- Test: `tests/admin/unit/client-detail-route.test.ts`
- Test: `tests/admin/unit/member-route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()` (`lib/agents/authAgent.ts:76-80`, returns `{ allow: true }` or `{ allow: false, reason: "unauthenticated" | "forbidden" }`), Task 4's schemas and error map, Task 5's `callAdminRpc` + `AdminRpcError`, `RouteContext<"/api/admin/clients/[clientId]">`.
- Produces: `jsonResponse(body, status)`, `readJsonBody(request)`, `firstIssueMessage(error)`; four endpoints. Task 12's client calls the same paths.

- [x] **Step 1: Write the shared HTTP leaf.** Create `lib/admin/http.ts`. Four handlers repeating fifteen header lines is how one of them drifts, so the shape lives once — mirroring `app/api/metrics/[clientId]/overview/route.ts:26-30`:

```ts
import { z } from "zod";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  Vary: "Cookie",
} as const;

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** Body, the zod issue's own message, or a shape error — in that order. */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, message: "Send a JSON body." };
  }
  return { ok: true, value: raw };
}

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check that value.";
}

export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}
```

- [x] **Step 2: Write the failing route tests.** Create `tests/admin/unit/clients-route.test.ts`, following the house idiom from `tests/dashboard/unit/overview-route.test.ts` (boundary mocked with `vi.hoisted`, handler called with `new Request(url)` and a `Promise`-shaped params object):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  callAdminRpc: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {}, remove: () => {} }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/authAgent", () => ({ requireAdmin: hoisted.requireAdmin }));
vi.mock("@/lib/admin/rpc", async (importActual) => {
  const actual = (await importActual()) as typeof import("@/lib/admin/rpc");
  return { ...actual, callAdminRpc: hoisted.callAdminRpc };
});

import { POST } from "@/app/api/admin/clients/route";
import { AdminRpcError } from "@/lib/admin/rpc";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/clients", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  hoisted.callAdminRpc.mockReset();
  hoisted.requireAdmin.mockReset();
  hoisted.requireAdmin.mockResolvedValue({ allow: true });
});

describe("POST /api/admin/clients", () => {
  it("is 403 for a signed-in non-admin, and never reaches the RPC", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 401 with no session", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "unauthenticated" });
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(401);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 with zod's own message for a scheme in the domain", async () => {
    const response = await POST(request({ name: "Atlas", domain: "http://atlas.example" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Enter a bare domain, e.g. atlas.example");
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for a body that is not JSON", async () => {
    const response = await POST(request("name=Atlas"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Send a JSON body.");
  });

  it("echoes the row the RPC returned", async () => {
    const row = { id: "7", name: "Atlas", domain: "atlas.example", is_active: true, created_at: "now" };
    hoisted.callAdminRpc.mockResolvedValue(row);
    const response = await POST(request({ name: "  Atlas  ", domain: "ATLAS.example" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ client: row });
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    });
  });

  it("maps a domain collision to 409 with the §7 string", async () => {
    hoisted.callAdminRpc.mockRejectedValue(new AdminRpcError("admin_create_client", "23505"));
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      "Another client already owns that domain.",
    );
  });

  it("maps a lost admin to 403", async () => {
    hoisted.callAdminRpc.mockRejectedValue(new AdminRpcError("admin_create_client", "42501"));
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("You no longer have admin access.");
  });

  it("maps a code-less failure to 502 without leaking Postgres text", async () => {
    hoisted.callAdminRpc.mockRejectedValue(new AdminRpcError("admin_create_client", undefined));
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("Could not reach the database.");
  });

  it("sends no-store and Vary: Cookie on every branch", async () => {
    hoisted.callAdminRpc.mockRejectedValue(new AdminRpcError("admin_create_client", "45001"));
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });
});
```

Create `tests/admin/unit/client-detail-route.test.ts` (PATCH, param validation):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  callAdminRpc: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {}, remove: () => {} }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/authAgent", () => ({ requireAdmin: hoisted.requireAdmin }));
vi.mock("@/lib/admin/rpc", async (importActual) => {
  const actual = (await importActual()) as typeof import("@/lib/admin/rpc");
  return { ...actual, callAdminRpc: hoisted.callAdminRpc };
});

import { PATCH } from "@/app/api/admin/clients/[clientId]/route";
import { AdminRpcError } from "@/lib/admin/rpc";

const UUID = "00000000-0000-4000-8000-0000000000aa";

function request(body: unknown) {
  return new Request(`http://localhost/api/admin/clients/${UUID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function ctx(clientId: string) {
  return { params: Promise.resolve({ clientId }) };
}

beforeEach(() => {
  hoisted.callAdminRpc.mockReset();
  hoisted.requireAdmin.mockReset();
  hoisted.requireAdmin.mockResolvedValue({ allow: true });
});

describe("PATCH /api/admin/clients/[clientId]", () => {
  it("is 403 before reading the body", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await PATCH(request({ name: "Atlas" }), ctx(UUID));
    expect(response.status).toBe(403);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for a non-uuid param", async () => {
    const response = await PATCH(request({ name: "Atlas" }), ctx("7"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid client id");
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for an empty body — the RPC's both-null case is unreachable from the app", async () => {
    const response = await PATCH(request({}), ctx(UUID));
    expect(response.status).toBe(400);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("passes only the keys it was given, so Postgres' defaults apply", async () => {
    hoisted.callAdminRpc.mockResolvedValue({ id: UUID, is_active: false });
    const response = await PATCH(request({ isActive: false }), ctx(UUID));
    expect(response.status).toBe(200);
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_update_client", {
      p_id: UUID,
      p_is_active: false,
    });
    expect(
      JSON.stringify(hoisted.callAdminRpc.mock.calls[0][1]),
    ).not.toContain("p_name");
  });

  it("maps a vanished client to 409", async () => {
    hoisted.callAdminRpc.mockRejectedValue(new AdminRpcError("admin_update_client", "45002"));
    const response = await PATCH(request({ name: "Atlas" }), ctx(UUID));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("That client no longer exists.");
  });
});
```

Create `tests/admin/unit/member-route.test.ts` (PUT + DELETE):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  callAdminRpc: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {}, remove: () => {} }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/authAgent", () => ({ requireAdmin: hoisted.requireAdmin }));
vi.mock("@/lib/admin/rpc", async (importActual) => {
  const actual = (await importActual()) as typeof import("@/lib/admin/rpc");
  return { ...actual, callAdminRpc: hoisted.callAdminRpc };
});

import { DELETE, PUT } from "@/app/api/admin/members/[userId]/route";
import { AdminRpcError } from "@/lib/admin/rpc";

const UUID = "00000000-0000-4000-8000-0000000000bb";

function request(body: unknown, method = "PUT") {
  return new Request(`http://localhost/api/admin/members/${UUID}`, {
    method,
    body: method === "DELETE" ? undefined : JSON.stringify(body),
  });
}

function ctx(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

beforeEach(() => {
  hoisted.callAdminRpc.mockReset();
  hoisted.requireAdmin.mockReset();
  hoisted.requireAdmin.mockResolvedValue({ allow: true });
});

describe("PUT /api/admin/members/[userId]", () => {
  it("is 403 for a non-admin before any RPC", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await PUT(request({ role: "staff" }), ctx(UUID));
    expect(response.status).toBe(403);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for an unknown role", async () => {
    const response = await PUT(request({ role: "owner" }), ctx(UUID));
    expect(response.status).toBe(400);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for a non-uuid path param", async () => {
    const response = await PUT(request({ role: "staff" }), ctx("nope"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid user id");
  });

  it("sends an explicit null client so 'Unassigned' is expressible", async () => {
    hoisted.callAdminRpc.mockResolvedValue({ id: UUID, role: "client", client_id: null });
    await PUT(request({ role: "client", clientId: null }), ctx(UUID));
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_attach_member", {
      p_user_id: UUID,
      p_role: "client",
      p_client_id: null,
    });
  });

  it("omits the key entirely when the body omitted it", async () => {
    hoisted.callAdminRpc.mockResolvedValue({ id: UUID, role: "admin", client_id: null });
    await PUT(request({ role: "admin" }), ctx(UUID));
    expect(
      JSON.stringify(hoisted.callAdminRpc.mock.calls[0][1]),
    ).not.toContain("p_client_id");
  });

  it("maps the last-admin refusal to 409", async () => {
    hoisted.callAdminRpc.mockRejectedValue(new AdminRpcError("admin_attach_member", "45001"));
    const response = await PUT(request({ role: "staff" }), ctx(UUID));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      "Assign another admin before removing this one.",
    );
  });
});

describe("DELETE /api/admin/members/[userId]", () => {
  it("detaches and echoes the removed row", async () => {
    hoisted.callAdminRpc.mockResolvedValue({ id: UUID, role: "staff", client_id: null });
    const response = await DELETE(request(undefined, "DELETE"), ctx(UUID));
    expect(response.status).toBe(200);
    expect((await response.json()).member).toMatchObject({ id: UUID });
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_detach_member", {
      p_user_id: UUID,
    });
  });

  it("maps 'already detached' to 409", async () => {
    hoisted.callAdminRpc.mockRejectedValue(new AdminRpcError("admin_detach_member", "45002"));
    const response = await DELETE(request(undefined, "DELETE"), ctx(UUID));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("That account is not provisioned.");
  });

  it("is 403 for a non-admin", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await DELETE(request(undefined, "DELETE"), ctx(UUID));
    expect(response.status).toBe(403);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3: Run them to verify they fail.**

Run: `pnpm vitest run --project unit tests/admin/unit/{clients-route,client-detail-route,member-route}.test.ts`
Expected: module-not-found for the three route modules. Measured: `3 failed (3) / no tests`, each
with `Cannot find package '@/app/api/admin/…/route'` — including for the bracketed paths, which
resolve fine once the files exist.

- [x] **Step 4: Write `app/api/admin/clients/route.ts`.**

```ts
import { requireAdmin } from "@/lib/agents/authAgent";
import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";
import { badRequest, firstIssueMessage, jsonResponse, readJsonBody } from "@/lib/admin/http";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { createClientBody } from "@/lib/admin/schemas";

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.allow) {
    return jsonResponse(
      { error: gate.reason === "unauthenticated" ? "Unauthorized" : "Forbidden" },
      gate.reason === "unauthenticated" ? 401 : 403,
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) return badRequest(body.message);

  const parsed = createClientBody.safeParse(body.value);
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));

  try {
    const client = await callAdminRpc("admin_create_client", {
      p_name: parsed.data.name,
      p_domain: parsed.data.domain,
    });
    return jsonResponse({ client }, 200);
  } catch (error) {
    const code = error instanceof AdminRpcError ? error.code : undefined;
    return jsonResponse(
      { error: adminErrorMessage("admin_create_client", code) },
      adminErrorStatus(code),
    );
  }
}
```

`adminErrorMessage` takes an `AdminWriteRpc`, so each handler passes its own function name literally — that is what makes §7's two `23503` messages switchable without reading message text.

- [x] **Step 5: Write `app/api/admin/clients/[clientId]/route.ts`.**

```ts
import { z } from "zod";

import { requireAdmin } from "@/lib/agents/authAgent";
import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";
import { badRequest, firstIssueMessage, jsonResponse, readJsonBody } from "@/lib/admin/http";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { updateClientBody } from "@/lib/admin/schemas";

const clientIdSchema = z.uuid();

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/clients/[clientId]">,
) {
  const gate = await requireAdmin();
  if (!gate.allow) {
    return jsonResponse(
      { error: gate.reason === "unauthenticated" ? "Unauthorized" : "Forbidden" },
      gate.reason === "unauthenticated" ? 401 : 403,
    );
  }

  const { clientId: rawClientId } = await ctx.params;
  const clientId = clientIdSchema.safeParse(rawClientId);
  if (!clientId.success) return badRequest("Invalid client id");

  const body = await readJsonBody(request);
  if (!body.ok) return badRequest(body.message);

  const parsed = updateClientBody.safeParse(body.value);
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));

  try {
    const client = await callAdminRpc("admin_update_client", {
      p_id: clientId.data,
      // undefined, not null: JSON.stringify drops the key, the parameter then takes
      // its declared default (null), and the body's coalesce turns that into "leave
      // this column alone". Both p_name and p_is_active use that mechanism, which is
      // why a partial PATCH needs no second round trip to read the row.
      p_name: parsed.data.name,
      p_is_active: parsed.data.isActive,
    });
    return jsonResponse({ client }, 200);
  } catch (error) {
    const code = error instanceof AdminRpcError ? error.code : undefined;
    return jsonResponse(
      { error: adminErrorMessage("admin_update_client", code) },
      adminErrorStatus(code),
    );
  }
}
```

- [x] **Step 6: Write `app/api/admin/members/[userId]/route.ts`.**

```ts
import { z } from "zod";

import { requireAdmin } from "@/lib/agents/authAgent";
import { adminErrorMessage, adminErrorStatus, type AdminWriteRpc } from "@/lib/admin/errors";
import { badRequest, firstIssueMessage, jsonResponse, readJsonBody } from "@/lib/admin/http";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { attachMemberBody } from "@/lib/admin/schemas";

const userIdSchema = z.uuid();

async function gate(): Promise<Response | null> {
  const allowed = await requireAdmin();
  if (allowed.allow) return null;
  return jsonResponse(
    { error: allowed.reason === "unauthenticated" ? "Unauthorized" : "Forbidden" },
    allowed.reason === "unauthenticated" ? 401 : 403,
  );
}

// Each verb names its own RPC at the call site: that is how §7's two 23503
// sentences stay switchable without reading Postgres' message text.
function rpcFailure(rpc: AdminWriteRpc, error: unknown): Response {
  const code = error instanceof AdminRpcError ? error.code : undefined;
  return jsonResponse(
    { error: adminErrorMessage(rpc, code) },
    adminErrorStatus(code),
  );
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/admin/members/[userId]">,
) {
  const denied = await gate();
  if (denied) return denied;

  const { userId: rawUserId } = await ctx.params;
  const userId = userIdSchema.safeParse(rawUserId);
  if (!userId.success) return badRequest("Invalid user id");

  const body = await readJsonBody(request);
  if (!body.ok) return badRequest(body.message);

  const parsed = attachMemberBody.safeParse(body.value);
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));

  try {
    const member = await callAdminRpc("admin_attach_member", {
      p_user_id: userId.data,
      p_role: parsed.data.role,
      p_client_id: parsed.data.clientId,
    });
    return jsonResponse({ member }, 200);
  } catch (error) {
    return rpcFailure("admin_attach_member", error);
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/members/[userId]">,
) {
  const denied = await gate();
  if (denied) return denied;

  const { userId: rawUserId } = await ctx.params;
  const userId = userIdSchema.safeParse(rawUserId);
  if (!userId.success) return badRequest("Invalid user id");

  try {
    const member = await callAdminRpc("admin_detach_member", {
      p_user_id: userId.data,
    });
    return jsonResponse({ member }, 200);
  } catch (error) {
    return rpcFailure("admin_detach_member", error);
  }
}
```

`failed()` and `gate()` are local to this file because both verbs share them; the other two route files each have one verb and keep their five lines inline. Note DELETE's error branch calls `adminErrorMessage` with `admin_detach_member`, not the attach name — that is deviation 2's whole cost, one line each.

**As shipped, two changes.** First, the drafted `failed(error, code)` took an `error` it never used
and hardcoded `admin_attach_member`, which is why DELETE had to inline a second copy of the same five
lines. It is now `rpcFailure(rpc: AdminWriteRpc, error: unknown)`, called with each verb's own name
literally (`"admin_attach_member"` / `"admin_detach_member"`), so deviation 2 still costs exactly one
word per call site and the shape exists once. `gate()` is unchanged apart from the local variable
name. Second, the PUT's comment over `p_client_id` as drafted asserted that an absent key leaves the
column alone; the DDL says otherwise (finding 7), so the comment now states that attach writes role
and tenant as one statement. That also tells Task 12 the dialog, not the schema, has to require a
client for `client` and `staff`.

- [x] **Step 7: Run the tests, then the gate.**

Run: `pnpm test admin`
Expected: all admin unit files green. `passes only the keys it was given` and `omits the key entirely when the body omitted it` are the two that fail if a handler substitutes `null` for `undefined` — fix the handler, not the assertion. Measured: `7 files / 49 tests` passed on the first run — the 26 cases from Tasks 4-5 plus the 23 drafted here, none of which needed editing.

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: green, `○ /dashboard`. The three new route handlers are dynamic; check `pnpm build` did **not** prerender them (no `○ /api/admin/…` line). Measured: unit `33 files / 209 tests`, `tsc --noEmit` exit 0 (which also means `next typegen` produced `RouteContext` entries for all three new paths), eslint exit 0 silent, and the route table shows `ƒ /api/admin/clients`, `ƒ /api/admin/clients/[clientId]`, `ƒ /api/admin/members/[userId]` with `○ /dashboard` still prerendered.

- [x] **Step 8: Report the diff and commit on approval.** King reads the code changes before they land.

```bash
git add lib/admin/http.ts "app/api/admin" tests/admin/unit/clients-route.test.ts \
  tests/admin/unit/client-detail-route.test.ts tests/admin/unit/member-route.test.ts
git commit -m "feat(admin): add the four provisioning verbs over the definer RPCs"
```

---

### Task 8: The anonymous gate, in both places that own it

`PROTECTED_PREFIXES` proves a session exists, not that it is an admin — §4's two gates are separate, and this task is the first half. The spec test is a case in `identity`, not `dashboard`, because `AGENTS.md`'s folder table assigns `lib/auth/routing` to `identity`.

**Files:**
- Modify: `lib/auth/routing.ts:22`
- Modify: `tests/identity/unit/routing.test.ts`
- Create: `tests/identity/e2e/admin-guard.spec.ts`

**Interfaces:**
- Consumes: `resolveProxyAction` and the existing public Playwright project.
- Produces: anonymous `/admin` → `/auth/login?next=%2Fadmin`. Task 11's page relies on this being the *only* thing standing between a logged-out visitor and the panel's server render.

- [x] **Step 1: Add the failing case.** In `tests/identity/unit/routing.test.ts`, inside the describe block that holds the per-path protected cases, add:

```ts
  it("protects /admin the way it protects /connections", () => {
    expect(resolveProxyAction("/admin", false)).toEqual({
      type: "redirect-login",
      next: "/admin",
    });
    expect(resolveProxyAction("/admin/", false)).toEqual({
      type: "redirect-login",
      next: "/admin/",
    });
    expect(resolveProxyAction("/admin", true)).toEqual({ type: "pass" });
    // The list is prefix-matched on `${prefix}/`, so a path that merely starts
    // with the same letters must stay public.
    expect(resolveProxyAction("/administrivia", false)).toEqual({ type: "pass" });
  });
```

The last assertion is the one that matters: the list is prefix-matched on `${prefix}/` or exact equality, so `/administrivia` must not be swept up by a loose `startsWith("/admin")`.

Run: `pnpm vitest run --project unit tests/identity/unit/routing.test.ts`
Expected: this new case fails on `"/admin"` (returns `{ type: "pass" }`). Measured: `1 failed | 7 passed
(8)`, the diff printing `- "type": "redirect-login"` / `+ "type": "pass"` at the first assertion.

- [x] **Step 2: Add the prefix.** In `lib/auth/routing.ts`:

```ts
const PROTECTED_PREFIXES = ["/dashboard", "/connections", "/admin", "/profile"];
```

`/admin` sits after `/connections` because both are pages a signed-in user reaches from inside the app, and `/profile` stays last as the account entry. Do not add `/admin` to `lib/navigation/destinations.ts` — §9's fourth doc item records that decision, and `tests/platform/unit/destinations.test.ts:53-60` checks rail → prefix only, so a protected prefix with no rail row passes untouched.

Run: `pnpm vitest run --project unit tests/identity/unit/routing.test.ts tests/platform/unit/destinations.test.ts`
Expected: both files green. Measured: `2 files / 15 tests` passed — routing 8, destinations 7. The
destinations file staying green is the point: `tests/platform/unit/destinations.test.ts:53-60` walks
rail → prefix, never prefix → rail, so a protected prefix with no rail row is invisible to it.

- [x] **Step 3: Write the browser guard spec.** Create `tests/identity/e2e/admin-guard.spec.ts`, mirroring `tests/identity/e2e/connections-guard.spec.ts` (read that file first and copy its exact imports and assertion style; this is the shape it uses):

```ts
import { expect, test } from "@playwright/test";

// Unlike connections-guard.spec.ts, this destination is deliberately absent from
// the rail (AccountMenu is its only entry), so nothing else in the test suite
// would notice a dropped prefix. proxy.ts decides on the path, not the route
// table, which is why this passes while /admin itself is still 404 for everyone.
test("an anonymous /admin visit lands on login with the return path", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fadmin$/);
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
});

test("anonymous /admin never renders provisioning copy", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Provisioning" })).toHaveCount(0);
});
```

No `@auth` tag: this runs in the `public` project, which is the CI tier, and it needs no database beyond a running dev server.

- [x] **Step 4: Run the public e2e tier.**

```bash
pnpm test:e2e
```

Expected: the existing count plus these two, all passed. If the URL assertion fails on ordering of query params, assert `/auth/login` and then `new URL(page.url()).searchParams.get("next")` equals `"/admin"` — the redirect's own encoding is not the invariant. Measured: `9 passed (3.4s)` (7 before), and the encoded-URL assertion held as drafted, so the fallback was not needed. The dev server on :3000 was already running and `reuseExistingServer: !isCI` let Playwright take it rather than starting a second one.

- [x] **Step 5: Gate, report the diff, and commit on approval.** King reads the code changes before they land.

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: green; `/dashboard` still `○`. Adding a protected prefix cannot make a prerendered page dynamic — `proxy.ts` runs at request time, not build time. Measured: unit `33 files / 210 tests`, `tsc --noEmit` exit 0, eslint exit 0 silent, build compiled with `○ /dashboard` and `ƒ /connections` unchanged and no `/admin` row (the page is Task 11).

```bash
git add lib/auth/routing.ts tests/identity/unit/routing.test.ts tests/identity/e2e/admin-guard.spec.ts
git commit -m "feat(admin): protect the /admin prefix for anonymous visitors"
```

---

### Task 9: `getAdminView()` — a read that merges instead of querying

The panel's two tables answer different questions, so the read is a left join by `id` done in TypeScript over two results (§6). Split it so the merge is testable without a database: `buildMemberViews()` and `withMemberCounts()` are pure, `getAdminView()` is the only I/O.

**Files:**
- Create: `lib/admin/provisioning.ts`
- Test: `tests/admin/unit/provisioning.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient()`, `callAdminRpc("admin_directory", {})` (Task 5), `MemberRole` (Task 4).
- Produces:

```ts
type PanelClient = { id: string; name: string; domain: string; isActive: boolean; memberCount: number };
type ProvisionedMember = { userId: string; email: string | null; name: string | null; role: MemberRole; clientId: string | null; clientName: string | null; createdAt: string; unlisted: boolean };
type PendingAccount = { userId: string; email: string | null; name: string | null; createdAt: string };
type MemberViews = { provisioned: ProvisionedMember[]; pending: PendingAccount[] };
type AdminView = { clients: PanelClient[]; members: MemberViews };
buildMemberViews(users: UserRow[], directory: DirectoryRow[]): MemberViews
withMemberCounts(clients: ClientRow[], provisioned: ProvisionedMember[]): PanelClient[]
getAdminView(): Promise<AdminView>
```

Task 10's page awaits `getAdminView()`; Task 12's mutations cause it to re-run through `router.refresh()`.

- [x] **Step 1: Write the failing merge test.** Create `tests/admin/unit/provisioning.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildMemberViews, withMemberCounts } from "@/lib/admin/provisioning";

const uuid = (label: string) =>
  `00000000-0000-4000-8000-${label.padEnd(12, "0")}`;

const directory = [
  { id: uuid("aaaa"), email: "ada@example.com", name: "Ada", created_at: "2026-09-01T00:00:00Z" },
  { id: uuid("bbbb"), email: "bob@example.com", name: null, created_at: "2026-09-02T00:00:00Z" },
  { id: uuid("cccc"), email: "cara@example.com", name: "Cara", created_at: "2026-09-03T00:00:00Z" },
];

describe("buildMemberViews", () => {
  it("splits the directory into provisioned and pending by users-row presence", () => {
    // The row literal goes in as an argument, not through a local: a local widens
    // `role` to string and stops matching the inferred UserRow.
    const views = buildMemberViews(
      [
        {
          id: uuid("cccc"),
          role: "staff",
          client_id: uuid("d1d1"),
          created_at: "2026-09-04T00:00:00Z",
        },
      ],
      directory,
    );
    expect(views.provisioned.map((m) => m.userId)).toEqual([uuid("cccc")]);
    expect(views.pending.map((p) => p.userId)).toEqual([uuid("aaaa"), uuid("bbbb")]);
  });

  it("takes email and display name from the directory, never from the users row", () => {
    const views = buildMemberViews(
      [{ id: uuid("aaaa"), role: "client", client_id: null, created_at: "2026-09-05T00:00:00Z" }],
      directory,
    );
    expect(views.provisioned[0]).toMatchObject({
      email: "ada@example.com",
      name: "Ada",
      clientId: null,
      clientName: null,
      unlisted: false,
    });
  });

  it("marks a member whose auth row the directory hid", () => {
    // users.id FK-references auth.users(id), so this should be unreachable —
    // but a truncated directory (the 1000-row cap) makes it real, and the panel
    // must not render a blank row when it does.
    const views = buildMemberViews(
      [{ id: uuid("zzzz"), role: "client", client_id: null, created_at: "2026-09-06T00:00:00Z" }],
      directory,
    );
    expect(views.provisioned).toHaveLength(1);
    expect(views.provisioned[0]).toMatchObject({ unlisted: true, email: null, name: null });
  });

  it("keeps pending accounts in signup order", () => {
    const views = buildMemberViews([], [directory[2], directory[0], directory[1]]);
    // Sorted by created_at, not left in argument order: an assertion that echoes
    // the input back would pass even if the merge stopped sorting.
    expect(views.pending.map((p) => p.email)).toEqual([
      "ada@example.com",
      "bob@example.com",
      "cara@example.com",
    ]);
  });

  it("sorts provisioned members by their users-row creation time", () => {
    const views = buildMemberViews(
      [
        { id: uuid("cccc"), role: "admin", client_id: null, created_at: "2026-09-09T00:00:00Z" },
        { id: uuid("aaaa"), role: "client", client_id: null, created_at: "2026-09-07T00:00:00Z" },
      ],
      directory,
    );
    expect(views.provisioned.map((m) => m.userId)).toEqual([uuid("aaaa"), uuid("cccc")]);
  });
});

describe("withMemberCounts", () => {
  it("groups provisioned members by client in one pass", () => {
    const clients = [
      { id: uuid("d1d1"), name: "Atlas", domain: "atlas.example", is_active: true },
      { id: uuid("d2d2"), name: "Borealis", domain: "borealis.example", is_active: false },
    ];
    const { provisioned } = buildMemberViews(
      [
        { id: uuid("aaaa"), role: "client", client_id: uuid("d1d1"), created_at: "2026-09-01T00:00:00Z" },
        { id: uuid("bbbb"), role: "staff", client_id: uuid("d1d1"), created_at: "2026-09-02T00:00:00Z" },
      ],
      directory,
    );
    const panel = withMemberCounts(clients, provisioned);
    expect(panel.map((c) => c.memberCount)).toEqual([2, 0]);
    expect(panel[1]).not.toHaveProperty("clientName");
  });

  it("maps is_active to isActive for the view model", () => {
    const panel = withMemberCounts(
      [{ id: uuid("d1d1"), name: "Atlas", domain: "atlas.example", is_active: true }],
      [],
    );
    expect(panel[0]).toEqual({
      id: uuid("d1d1"),
      name: "Atlas",
      domain: "atlas.example",
      isActive: true,
      memberCount: 0,
    });
  });
});
```

Run: `pnpm vitest run --project unit tests/admin/unit/provisioning.test.ts`
Expected: module-not-found. Measured: `1 failed (1) / Tests no tests`, and typecheck on the same draft
reported `TS2345` before a single case ran — see finding 8, which also fixes this file's pending-order
case.

- [x] **Step 2: Write `lib/admin/provisioning.ts`.**

```ts
import "server-only";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { callAdminRpc } from "@/lib/admin/rpc";
import { MEMBER_ROLES, type MemberRole } from "@/types/metrics";

const clientRow = z.object({
  id: z.uuid(),
  name: z.string(),
  domain: z.string(),
  is_active: z.boolean(),
});

const userRow = z.object({
  id: z.uuid(),
  role: z.enum(MEMBER_ROLES),
  client_id: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

const directoryRow = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

type ClientRow = z.infer<typeof clientRow>;
type UserRow = z.infer<typeof userRow>;
type DirectoryRow = z.infer<typeof directoryRow>;

export type PanelClient = {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  memberCount: number;
};

export type ProvisionedMember = {
  userId: string;
  email: string | null;
  name: string | null;
  role: MemberRole;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
  unlisted: boolean;
};

export type PendingAccount = {
  userId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
};

export type MemberViews = {
  provisioned: ProvisionedMember[];
  pending: PendingAccount[];
};

export type AdminView = {
  clients: PanelClient[];
  members: MemberViews;
};

const byCreatedAt = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt);

/**
 * public.users stores neither an email nor a display name, so every identity
 * string the panel renders comes from the directory. `unlisted` covers a member
 * the directory did not return — the 1000-row cap makes it reachable.
 */
export function buildMemberViews(
  users: UserRow[],
  directory: DirectoryRow[],
): MemberViews {
  const byAuthId = new Map(directory.map((row) => [row.id, row]));
  const provisioned: ProvisionedMember[] = [];
  const seen = new Set<string>();

  for (const user of users) {
    const identity = byAuthId.get(user.id);
    seen.add(user.id);
    provisioned.push({
      userId: user.id,
      email: identity?.email ?? null,
      name: identity?.name ?? null,
      role: user.role,
      clientId: user.client_id,
      clientName: null,
      createdAt: user.created_at,
      unlisted: identity === undefined,
    });
  }
  provisioned.sort(byCreatedAt);

  const pending = directory
    .filter((row) => !seen.has(row.id))
    .map((row) => ({
      userId: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
    }))
    .sort(byCreatedAt);

  return { provisioned, pending };
}

export function withMemberCounts(
  clients: ClientRow[],
  provisioned: ProvisionedMember[],
): PanelClient[] {
  const counts = new Map<string, number>();
  for (const member of provisioned) {
    if (member.clientId) {
      counts.set(member.clientId, (counts.get(member.clientId) ?? 0) + 1);
    }
  }
  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    domain: client.domain,
    isActive: client.is_active,
    memberCount: counts.get(client.id) ?? 0,
  }));
}

function attachClientNames(
  provisioned: ProvisionedMember[],
  clients: ClientRow[],
): ProvisionedMember[] {
  const nameById = new Map(clients.map((client) => [client.id, client.name]));
  return provisioned.map((member) =>
    member.clientId
      ? { ...member, clientName: nameById.get(member.clientId) ?? null }
      : member,
  );
}

/**
 * Reads are RLS-gated table selects; nothing here decides visibility.
 * `clients` is selected with no is_active filter on purpose — deactivating a
 * client has to leave it visible, or Pause is irreversible.
 */
export async function getAdminView(): Promise<AdminView> {
  const db = await createServerSupabaseClient();
  const [clientsResult, usersResult, directory] = await Promise.all([
    db.from("clients").select("id,name,domain,is_active").order("name"),
    db.from("users").select("id,role,client_id,created_at").order("created_at"),
    callAdminRpc("admin_directory", {}),
  ]);

  if (clientsResult.error) throw new Error("Admin read failed: clients");
  if (usersResult.error) throw new Error("Admin read failed: users");

  const clients = z.array(clientRow).parse(clientsResult.data);
  const users = z.array(userRow).parse(usersResult.data);
  const listed = z.array(directoryRow).parse(directory);

  const members = buildMemberViews(users, listed);
  return {
    clients: withMemberCounts(clients, members.provisioned),
    members: { ...members, provisioned: attachClientNames(members.provisioned, clients) },
  };
}
```

Three things are load-bearing in that body and get a line in the tracker if any is questioned: **no `is_active` filter** (deviation 1), **`Admin read failed: <table>` and never the Postgres message** (the constraint that no response carries database text, and §0.2's reason the admin read does not use `databaseOperation()`), and **`z.array(...).parse`** — a row that fails the schema throws, so the panel cannot render a half-truth about a role it cannot name.

- [x] **Step 3: Run the tests, then the gate.**

Run: `pnpm vitest run --project unit tests/admin/unit/provisioning.test.ts`
Expected: 7 passed. `withMemberCounts`' `not.toHaveProperty("clientName")` assertion guards against the panel later smuggling the join into the pure function — if it fails because you added `clientName` to `PanelClient`, remove it; `attachClientNames` owns that field. Measured: `7 passed (7)`, and it is the pending-order case that would have failed the draft as written (finding 8).

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: green. `typecheck` is the proof the zod-inferred row types line up with `types/database.ts`; `provisioning.test.ts` imports no database, so it runs in the unit project without `next/headers` mocked. Measured: unit `34 files / 217 tests`, eslint exit 0 silent, build compiled with `○ /dashboard` and `ƒ /connections` unchanged. **That one expectation was overstated** — see finding 9: `.parse()` takes `unknown`, so `tsc` proves the RPC's `Args`/`Returns` contract and nothing about the two table schemas.

- [x] **Step 4: Report the diff and commit on approval.** King reads the code changes before they land.

```bash
git add lib/admin/provisioning.ts tests/admin/unit/provisioning.test.ts
git commit -m "feat(admin): add the admin read path and the directory-to-members merge"
```

---

### Task 10: The bootstrap admin, and the guard on its footgun

`--admin` switches the env pair to `ADMIN_EMAIL`/`ADMIN_PASSWORD` and the role to `admin` with `client_id = null` (§9). The footgun is already in the script: `:45` lists up to 1000 auth users to find a match, so an address beyond page one reads as "does not exist" and the script would create a **second** admin silently.

**Files:**
- Modify: `scripts/create-demo-user.mjs`
- Modify: `.env.example` (after the `DEMO_*` block at `:33-37`)
- Modify: `package.json` (only if a `db:*` script name needs a sibling; read the existing `db:demo-user` entry first and leave it alone if it passes through argv)
- Test: `tests/identity/unit/admin-creds.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: an operator-runnable admin, the same account §8's fixture names, and `ADMIN_EMAIL`/`ADMIN_PASSWORD` as the pair `tests/helpers/load-e2e-env.ts:13` will hand Task 11's `@auth` specs.

- [x] **Step 1: Write the failing env-hygiene test.** Create `tests/identity/unit/admin-creds.test.ts` — this is §0.3's correction pinned so a future edit cannot re-add the leak:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const envExample = readFileSync(".env.example", "utf8");
const script = readFileSync("scripts/create-demo-user.mjs", "utf8");

describe("admin credentials stay server-side", () => {
  it("declares the ADMIN_ pair without a NEXT_PUBLIC_ prefix", () => {
    expect(envExample).toMatch(/^ADMIN_EMAIL=/m);
    expect(envExample).toMatch(/^ADMIN_PASSWORD=/m);
    expect(envExample).not.toMatch(/NEXT_PUBLIC_ADMIN_/);
  });

  it("never reads a NEXT_PUBLIC_ name for the admin pair in the script", () => {
    expect(script).not.toMatch(/NEXT_PUBLIC_ADMIN_/);
    expect(script).toMatch(/process\.env\.ADMIN_EMAIL/);
    expect(script).toMatch(/process\.env\.ADMIN_PASSWORD/);
  });

  it("refuses to run --admin when the account list was truncated", () => {
    expect(script).toMatch(/--admin/);
    expect(script).toMatch(/perPage:\s*1000/);
    // The guard has to compare the page size it asked for against what came back.
    expect(script).toMatch(/users\.length\s*>=?\s*1000/);
  });

  it("writes role only into the users row", () => {
    expect(script).toMatch(/role: asAdmin \? "admin" : "client"/);
    expect(script).not.toMatch(/raw_user_meta_data.*role/s);
  });
});
```

Run: `pnpm test identity/unit/admin-creds`
Expected: all four cases fail — no `ADMIN_EMAIL` in `.env.example`, no `--admin` in the script.
Measured: 4 failed, then 4 passed after Steps 2-3. **The drafted last case does not compile**:
`/raw_user_meta_data.*role/s` is `TS1501 — This regular expression flag is only available when
targeting 'es2018' or later`, because `tsconfig.json:3` sets `"target": "ES2017"` (the `lib: esnext`
on the next line does not rescue it — the compiler checks flags against `target`). Shipped as
`/raw_user_meta_data[\s\S]*role`, which matches the same thing. The third case also asserts
`/>=\s*1000/` and `/Refusing to create an admin/` rather than the drafted
`/users\.length\s*>=?\s*1000/`, because the guard reads `(existing?.users.length ?? 0) >= 1000`
after the `?? 0`, and pinning the sentence the operator actually sees is the point.

- [x] **Step 2: Add the env names.** In `.env.example`, directly under the `DEMO_CLIENT_ID=` line, add (names only, no values — `RULES.md` §16):

```
# Bootstrap the control-plane admin: `pnpm db:demo-user -- --admin`.
# Same shape as the demo pair; never NEXT_PUBLIC_ — these reach the client bundle.
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

`package.json` is untouched, which is what this step's condition asked for: `db:demo-user` is
`node … scripts/create-demo-user.mjs` with no argv of its own, so `pnpm db:demo-user -- --admin`
reaches the script. The drafted `node scripts/create-demo-user.mjs --admin` still works and is what
Step 4 runs; the `.env.example` line names the pnpm form because that is how the demo pair is
documented two lines above it.

- [x] **Step 3: Add the flag to the script.** At the top of `scripts/create-demo-user.mjs`, replace the four env reads and their guard with:

```js
const asAdmin = process.argv.includes("--admin");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = asAdmin ? process.env.ADMIN_EMAIL : process.env.DEMO_EMAIL;
const password = asAdmin ? process.env.ADMIN_PASSWORD : process.env.DEMO_PASSWORD;
const emailName = asAdmin ? "ADMIN_EMAIL" : "DEMO_EMAIL";
const passwordName = asAdmin ? "ADMIN_PASSWORD" : "DEMO_PASSWORD";

if (!url || !serviceRole || !email || !password) {
  console.error(
    `Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ` +
      `${emailName}, ${passwordName} in .env` +
      (asAdmin ? " (or drop --admin to use the DEMO_ pair)" : ""),
  );
  process.exit(1);
}
```

Then make the client lookup conditional — an admin has no tenant (`users_admin_has_no_tenant`), so requiring an active client would be a lie — by wrapping the existing `clients` select, the `clients.length === 0` exit, and the `client` pick in `if (!asAdmin) { … }`, declaring `let client = null;` above it.

At the auth-list step, add the truncation guard:

```js
const { data: existing, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) {
  console.error("listUsers failed:", listError.message);
  process.exit(1);
}
const current = existing?.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);
if (asAdmin && !current && (existing?.users.length ?? 0) >= 1000) {
  // The list is one page. An address past it looks absent, and "absent" here
  // means create — which would hand a second admin to a project that already
  // has one without saying so.
  console.error(
    `Refusing to create an admin: the first 1000 auth accounts do not include ` +
      `${email}, so it may exist past page one. Provision it by id instead.`,
  );
  process.exit(1);
}
```

and change the two writes below it to:

```js
user_metadata: { name: asAdmin ? "Admin" : "Demo User" },
```

```js
  .upsert(
    {
      id: authUserId,
      role: asAdmin ? "admin" : "client",
      client_id: asAdmin ? null : client.id,
    },
    { onConflict: "id" },
  );
```

Finally make the closing logs conditional (`client_id: null` has no client to name):

```js
console.log(
  asAdmin
    ? "Linked as an admin with no client (users_admin_has_no_tenant)."
    : `Linked to client "${client.name}" (${client.domain}).`,
);
```

The file's header comment now names both modes and both env pairs, since the first line used to
promise only the demo account. Checked against the DDL rather than trusted: `users_admin_has_no_tenant`
is real (`20260917000000_seo_poc.sql:26`, `check (role <> 'admin' or client_id is null)`), so the
`client_id: null` write is the constraint's own shape, not a guess.

- [x] **Step 4: Run the test, then provision against the local stack.**

Run: `pnpm test identity/unit/admin-creds`
Expected: four passed.

```bash
ADMIN_EMAIL=operator@rls-test.local ADMIN_PASSWORD=local-only-password \
  SUPABASE_SERVICE_ROLE_KEY="$(grep -m1 '^TEST_SUPABASE_SERVICE_ROLE_KEY=' .env.test | cut -d= -f2-)" \
  NEXT_PUBLIC_SUPABASE_URL="$(grep -m1 '^TEST_SUPABASE_URL=' .env.test | cut -d= -f2-)" \
  node scripts/create-demo-user.mjs --admin
```

Expected: `Created auth user … (operator@rls-test.local).` then `Linked as an admin with no client (…)`. Re-run it: expected `Updated auth user …`, and **still exactly one** admin row:

```bash
pnpm exec supabase db query --sql "select count(*) from public.users where role = 'admin';"
```

Note the count before and after; `provisionFixtures` already creates `admin@rls-test.local`, so "one admin" is only true if the fixture ran — record the number you saw, do not assert a shape you did not observe. **Never run this without the inline `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` overrides** — bare, the script reads `.env` and creates an admin on hosted production.

Measured (Docker had to be resumed and `pnpm exec supabase start` re-run first; the stack persisted
its volumes, so the fixture rows were already there): admins **1 → 2**, `Created auth user da0fe3bf…
(operator@rls-test.local)` then `Linked as an admin with no client (users_admin_has_no_tenant)`, and
the re-run printed `Updated auth user da0fe3bf…` with the count still 2 — idempotent, no second row.
`select id, role, client_id from public.users where role = 'admin'` returned both rows with
`client_id` null, which is the constraint's shape and not a coincidence. The non-admin path was
re-checked the same way (`DEMO_EMAIL=probe@…` with the same inline overrides) and still printed
`Linked to client "Northstar Studio" (northstar.example)`, so wrapping the `clients` select in
`if (!asAdmin)` did not break the original behaviour.

**And the step as written breaks the integration tier it sits next to.** With a second admin row on
the local stack, `pnpm test:integration` gives `2 failed / 17 passed`, reproducibly:

- `refuses to detach the last admin` fails at its own precondition, `tests/admin/integration/provisioning.test.ts:170`
  — `expect((before.data ?? []).length).toBe(1)` → `expected 2 to be 1`. It asserts global state
  rather than state it owns.
- `refuses to demote the last admin through attach` (`:184`) fails *after* writing: it takes
  `before.data![0]` with no order by, and with two admins the RPC is right to allow the demotion, so
  the call **succeeds** and the assertion reads `expected undefined to be '45001'`. The extra
  `operator@rls-test.local` row was left as `staff` with a tenant by that test — a suite mutating a
  row it does not own, which is what Task 6's own rule is for ("destructive cases create their own
  scratch auth user inside the file and delete it in `afterEach` — never another suite's fixture
  rows"). Both cases pass again with one admin (4 consecutive green runs, 19/19).

The bootstrap account was therefore deleted from the local stack after the verification
(`users` row then `auth.users`, via the direct `54322` connection — not through `.env`), leaving the
four fixture identities and one admin. Carry-forward for Task 11, which needs an admin to sign in as:
**the last-admin cases and a second admin cannot share a stack.** Either scope those two cases to
`FIXTURE_USERS.admin`'s id (they can look it up, and then a second admin stops being a precondition
violation), or run the `@auth` specs against a stack where the integration tier is not run. The first
option is small and removes a real landmine; it edits a shipped Task 6 file, so it is King's call, not
a quiet side-fix.

- [x] **Step 5: Gate and commit.**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: green.
Measured: unit **35 files / 221 tests** passed, typecheck and lint clean (after the ES2017 regex-flag
fix above), build green with `/dashboard` still `○` and the three `/api/admin/*` routes still `ƒ`.
Integration re-checked at 19/19 once the bootstrap row was removed. Commit waits for King's read of
the diff.

```bash
git add scripts/create-demo-user.mjs .env.example tests/identity/unit/admin-creds.test.ts
git commit -m "feat(scripts): add an --admin bootstrap that refuses to guess at a truncated list"
```

---

### Task 11: The page, rendered read-only

Ship the panel with no working buttons first, and answer §10.2's build question with `pnpm build` rather than an assumption. Then Task 12 adds only behaviour.

**Files:**
- Create: `app/(app)/admin/page.tsx`
- Create: `components/features/admin/index.ts`
- Create: `components/features/admin/components/admin-panel.tsx`
- Create: `components/features/admin/components/client-table.tsx`
- Create: `components/features/admin/components/member-table.tsx`
- Modify: `components/features/user-profile/components/account-menu.tsx` (one item)
- Modify: `tests/helpers/log-in.ts` (widen to a role)
- Create: `tests/admin/e2e/panel.spec.ts`
- Create: `tests/admin/e2e/layout.spec.ts`

**Interfaces:**
- Consumes: `getAdminView()` and its exported view types (Task 9), `AppShell` via `app/(app)/layout.tsx` (no import needed — the route group wraps it), `activeDestination("/admin") → null`, `Badge`/`Button` variants from `components/ui`.
- Produces: `<AdminPanel view={…} />` and a rendered `/admin`. Task 12 replaces the disabled controls with real ones.

- [x] **Step 1: Write the page.** Create `app/(app)/admin/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPanel } from "@/components/features/admin";
import { requireAdmin } from "@/lib/agents/authAgent";
import { getAdminView } from "@/lib/admin/provisioning";

export const metadata: Metadata = {
  title: "Admin — JK Intelligence",
};

/** Dynamic for the same reason /connections is: the read is cookie-bound and the
 *  shared db wrapper would turn a prerender bailout into a build error. If this
 *  line ever stops being load-bearing, delete it and say so in the tracker. */
export const dynamic = "force-dynamic";

export default async function Page() {
  const decision = await requireAdmin();
  if (!decision.allow) redirect("/dashboard");
  return <AdminPanel view={await getAdminView()} />;
}
```

The `redirect` is the second of §4's two gates: a prefix match proves a session exists, not that it is an admin.

Shipped as drafted, with the three imports sorted (`@/components/features/admin`, `@/lib/admin/provisioning`,
`@/lib/agents/authAgent`) because the drafted order interleaved the two `lib` paths.

- [x] **Step 2: Write the barrel.** Create `components/features/admin/index.ts`:

```ts
export { AdminPanel } from "./components/admin-panel";
```

- [x] **Step 3: Write the panel shell.** Create `components/features/admin/components/admin-panel.tsx`:

```tsx
import { AttachMemberDialog } from "./attach-member-dialog";
import { ClientDialog } from "./client-dialog";
import { ClientTable } from "./client-table";
import { MemberTable } from "./member-table";
import type { AdminView } from "@/lib/admin/provisioning";

export function AdminPanel({ view }: { view: AdminView }) {
  const { clients, members } = view;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              Provisioning
            </h1>
            <p className="text-sm text-muted-foreground">
              Clients and the accounts that belong to them.
            </p>
          </div>
          <ClientDialog mode="create" />
        </div>
        {clients.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No clients yet. Create one to start assigning accounts.
          </p>
        ) : (
          <ClientTable clients={clients} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Members
          </h2>
          {members.pending.length > 0 && (
            <AttachMemberDialog accounts={members.pending} />
          )}
        </div>
        {members.provisioned.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Accounts that signed up but were never provisioned appear here.
          </p>
        ) : (
          <MemberTable members={members.provisioned} />
        )}
      </section>

      {members.pending.length === 0 && members.provisioned.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Every account is already provisioned.
        </p>
      )}
    </div>
  );
}
```

Stacked, never side-by-side, and it stays stacked at `lg` (§5). The three copy strings are §7's empty states in the order a real account meets them.

**Step 3 shipped a different vocabulary than drafted, on purpose.** The draft wrote raw
`<section>`/`<div>` with `text-foreground` / `text-muted-foreground` / `font-semibold`; those token
names are the shadcn defaults, and this app overrides them — `context/ui-context.md` and every
shipped page use `text-text-primary` / `text-text-muted` / `text-text-faint` and `font-serif`
headings at `font-medium`. `app/(app)/connections/…/connections-page.tsx` is the closest analogue
(a server page inside the shell), so the panel copies its `<main className="max-w-7xl …">` chrome
and puts each table in a `Card` with `CardHeader`/`CardTitle`/`CardAction`/`CardContent`, which is
what `components/ui/card.tsx` exists for — `CardAction` is what turns the header grid into
`1fr auto` so the dialog trigger sits at the right edge. §5's stacking rule and §7's three strings
are unchanged; the strings are verbatim.

- [x] **Step 4: Write the two tables.** Create `components/features/admin/components/client-table.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PanelClient } from "@/lib/admin/provisioning";

export function ClientTable({ clients }: { clients: PanelClient[] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Client</th>
            <th className="py-2 pr-4 font-medium">Domain</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Members</th>
            <th className="py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id} className="border-b border-border/60">
              <td className="py-2.5 pr-4 font-medium text-foreground">
                {client.name}
              </td>
              <td className="hidden py-2.5 pr-4 text-muted-foreground sm:table-cell">
                {client.domain}
              </td>
              <td className="py-2.5 pr-4">
                <Badge variant={client.isActive ? "secondary" : "outline"}>
                  {client.isActive ? "Active" : "Paused"}
                </Badge>
              </td>
              <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                {client.memberCount}
              </td>
              <td className="py-2.5">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled>
                    Rename
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    {client.isActive ? "Pause" : "Resume"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

The `disabled` controls are Task 12's slot, and the component owns its own status strings ("Active" / "Paused") the way the catalog owns its own — a `bool ? "Active" : "Inactive"` inlined twice would be the drift the last session's fix targeted. Secondary columns (`Domain`, `Members`) drop below `sm`, and the clipper is `relative overflow-x-auto` because a plain `overflow-x-auto` lets `sr-only` descendants escape it.

Both tables keep the drafted column set, the `hidden … sm:table-cell` drop and the clipper. Three
changes: the header row uses the shipped table vocabulary (`bg-surface border-b border-default
text-text-muted font-medium font-mono text-[11px]`, `divide-y divide-border-default`,
`hover:bg-secondary/30 transition-colors`) copied from `components/features/dashboard/components/query-table.tsx`,
which is the only other raw `<table>` in the app — nothing imports `components/ui/table.tsx`, so
that file is the precedent, not the primitive; each table gains a `<caption className="sr-only">`
so the landmark announces itself to a screen reader; and the member table's account cell no longer
prints the email twice. The drafted cell rendered `name ?? email` above `email`, so every account
without a display name showed the same string on both lines (all of them, on this stack). It now
derives `primary = name ?? email ?? "Unnamed account"` and shows the second line only when it adds
something — a distinct email, or `"Not in the directory"` for an `unlisted` row.

Create `components/features/admin/components/member-table.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProvisionedMember } from "@/lib/admin/provisioning";

export function MemberTable({ members }: { members: ProvisionedMember[] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Account</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="hidden py-2 pr-4 font-medium sm:table-cell">Client</th>
            <th className="py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.userId} className="border-b border-border/60">
              <td className="py-2.5 pr-4">
                <span className="block font-medium text-foreground">
                  {member.name ?? member.email ?? "Unnamed account"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {member.email ?? (member.unlisted ? "Not in the directory" : "No email")}
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <Badge variant="outline">{member.role}</Badge>
              </td>
              <td className="hidden py-2.5 pr-4 text-muted-foreground sm:table-cell">
                {member.clientName ?? "Unassigned"}
              </td>
              <td className="py-2.5">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" disabled>
                    Detach
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`"Unassigned"` is a value, not an error (§7). `role` renders as stored — `admin` / `client` / `staff` — because the panel is a control surface and translating role names into product nouns would invent a second vocabulary.

- [x] **Step 5: Stub the two dialogs so the build compiles.** Create `components/features/admin/components/client-dialog.tsx` and `components/features/admin/components/attach-member-dialog.tsx` with the shapes Task 12 fills in — a `Dialog` trigger button, `disabled`, no form yet:

```tsx
// client-dialog.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ClientDialog({ mode }: { mode: "create" | "rename"; name?: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" disabled />}>
        {mode === "create" ? "Create client" : "Rename"}
      </DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New client" : "Rename client"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "The domain is fixed once created."
              : "The domain cannot be changed after creation."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// attach-member-dialog.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PendingAccount } from "@/lib/admin/provisioning";

export function AttachMemberDialog({ accounts }: { accounts: PendingAccount[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>Attach account</DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Attach account</DialogTitle>
          <DialogDescription>
            Give a signed-up account a role{accounts.length > 0 ? `, starting with ${accounts[0].email ?? "an unnamed account"}.` : "."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
```

(`client-table.tsx` renders its own disabled Rename button in Step 4; Task 12 replaces that with `<ClientDialog mode="rename" … />`. Verify `DialogTrigger`'s prop name against `components/ui/dialog.tsx` before writing — `profile-dialog.tsx` shows `DialogContent` takes `overlayClassName`, and the account menu shows the `render={<Button/>}` idiom, but read the file rather than trusting either.)

Checked: `DialogTrigger` takes `render` (Base UI, not Radix's `asChild`), and `DialogContent` takes
`overlayClassName`. One deviation — the drafted attach-member trigger forgot `disabled`, and Step 5's
own instruction is "a `Dialog` trigger button, `disabled`, no form yet". Both triggers ship
`<Button size="sm" disabled />`, so nothing in Task 11's page opens a dialog that cannot submit.
`DialogTrigger`'s prose is otherwise verbatim, including the `accounts[0].email` conditional.

- [x] **Step 6: Add the entry point.** In `components/features/user-profile/components/account-menu.tsx`, insert between the Profile item (`:79-82`) and the Log out item:

```tsx
            {profile?.role === "admin" && (
              <DropdownMenuItem onClick={() => router.push("/admin")}>
                <ShieldCheck aria-hidden="true" />
                Admin
              </DropdownMenuItem>
            )}
```

and add `ShieldCheck` to the existing `lucide-react` import. One conditional on a prop the component already receives — no new server prop, no change to `/api/dashboard/boot`, no role filter in `lib/navigation/destinations.ts`.

**This is the step that needs a follow-up decision, and Step 8 found it.** `AccountMenu` is rendered
by exactly one file — `app/(app)/dashboard/dashboard-view.tsx:236`, in the dashboard header — and
`components/features/dashboard/components/dashboard.tsx:86` (`EmptyShell`) renders *no header* for
its two no-data states (`!selectedClient`, and `!overview`). So the panel's only visible entry point
disappears precisely when the admin has nothing to look at: a brand-new admin on a project whose
first accessible client has no synced rows sees the empty shell, and from there the rail's three
destinations are the only links on the page. §4 chose `AccountMenu` over a rail row on the reasoning
that the menu already had the role; it did not check that the menu is always on screen. Recorded in
`context/progress-tracker.md` as an open item for Task 13 — the candidates are a fourth rail
destination for admins, a link inside `EmptyShell`, or giving the dashboard header its own gate.

- [x] **Step 7: Widen `logIn` to take a role.** Replace `tests/helpers/log-in.ts` with:

```ts
import { expect, type Page } from "@playwright/test";

type FixtureRole = "demo" | "admin";

const CRED_ENV: Record<FixtureRole, [string, string]> = {
  demo: ["DEMO_EMAIL", "DEMO_PASSWORD"],
  admin: ["ADMIN_EMAIL", "ADMIN_PASSWORD"],
};

export async function logIn(page: Page, role: FixtureRole = "demo") {
  const [emailName, passwordName] = CRED_ENV[role];
  const email = process.env[emailName];
  const password = process.env[passwordName];
  if (!email || !password) {
    throw new Error(`${emailName} / ${passwordName} are not in the environment`);
  }
  await page.goto("/auth/login");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  // Every role lands on /dashboard; an admin spec navigates from there. The
  // admin's own users row has client_id = null, so the dashboard paints its
  // empty shell — asserting the URL is still the honest check.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}
```

The default argument keeps all five existing `@auth` call sites unchanged.

Shipped as drafted: five spec files, six `logIn(page)` call sites, none edited. The throw earns its
place — it separates "the credential name is missing from the environment" from "the login did not
land", which is exactly the split Step 10 had to make.

- [x] **Step 8: Write the two `@auth` specs.** Create `tests/admin/e2e/panel.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { logIn } from "../../helpers/log-in";

// @auth is read-only by design: it is the only tier that can see the role gate and
// the phone-width clip, and it writes nothing so no test-created client outlives its run.
test("@auth an admin reaches the provisioning panel", async ({ page }) => {
  await logIn(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Provisioning" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach account" })).toBeVisible();
});

test("@auth a client-role account is bounced off /admin", async ({ page }) => {
  await logIn(page, "demo");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Provisioning" })).toHaveCount(0);
});

test("@auth the menu only offers Admin to an admin", async ({ page }) => {
  await logIn(page, "demo");
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Admin" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await logIn(page, "admin");
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Admin" })).toBeVisible();
});
```

Create `tests/admin/e2e/layout.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { logIn } from "../../helpers/log-in";

for (const viewport of [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
]) {
  test.describe(`@auth /admin at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("the page scrolls without a document-level overflow", async ({ page }) => {
      await logIn(page, "admin");
      await page.goto("/admin");
      const wide = await page.evaluate(() =>
        Math.min(document.documentElement.scrollWidth, document.body.scrollWidth),
      );
      expect(wide).toBeLessThanOrEqual(viewport.width + 1);
    });

    test("the rail renders with nothing marked active", async ({ page }) => {
      await logIn(page, "admin");
      await page.goto("/admin");
      await expect(
        page.getByRole("link", { name: "Dashboard" }),
      ).toHaveCount(1);
    });
  });
}
```

`activeDestination("/admin")` returns `null`, so no rail link carries the active state here — that is the second spec's whole point, and it is why Task 8 must not add a destination row.

Three defects in the drafted specs, all found by running them:

1. **The drafted third panel test cannot pass.** It calls `logIn(page, "demo")`, inspects the menu,
   then calls `logIn(page, "admin")` on the same page — but `/auth/login` redirects a signed-in
   visitor, so the second call never reaches the form and dies on `form.getByLabel("Email")` after
   30 s. Split into two tests, one role each, which is also the idiomatic shape: Playwright gives
   every test a fresh context, so no cookie surgery is needed. That makes **8 new tests** (4 panel
   + 4 layout), not the 5 Step 10's expected count claims.
2. **The admin half needs a client that has metrics**, because of Step 6's finding: on this stack the
   admin's default selection is an RLS fixture with no rows, so the dashboard paints `EmptyShell` and
   there is no `Account menu` button to click. The test reads `/api/dashboard/boot` (a GET; the tier
   stays read-only) and walks the accessible ids until the header appears, and throws a sentence that
   names the condition if none does. It is slower than its siblings (9.9 s vs ~2.5 s) and still nowhere
   near the timeout.
3. **The drafted layout assertion about the rail was wrong**, and `tests/dashboard/e2e/rail.spec.ts:36`
   already documents why: both `Sections` landmarks stay in the DOM at every width and only `:visible`
   tells them apart, so `getByRole("link", { name: "Dashboard" })` → `toHaveCount(1)` would have
   counted two. Shipped as `page.locator("nav[aria-label='Sections']:visible")` → `toHaveCount(1)`,
   plus `sections.locator("[aria-current]")` → `toHaveCount(0)`, which is the actual claim: the rail is
   rendered, and nothing in it is marked active.

- [x] **Step 9: Answer the build question.**

Run: `pnpm build`
Expected: the route table prints **`ƒ /admin`** and **`○ /dashboard`**. If `/dashboard` has become `ƒ`, stop and find out why before continuing — the shell reads no session and must stay that way (Task 13 documents this). If `/admin` builds as `○`, the `force-dynamic` line is not doing what its comment claims; check whether Next opted the segment out on its own and record which.

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: green.

Measured: `pnpm build` prints **`ƒ /admin`** (dynamic, as its comment claims) and **`○ /dashboard`**
(unchanged — the shell still reads no session), alongside `ƒ /connections` and `ƒ /profile`.
`pnpm test:all` 38 files / 240 tests, `pnpm typecheck` and `pnpm lint` clean. The build was re-run
after the Step 10 CSP change and after the member-table cell fix; both times the route table matched.

- [x] **Step 10: Run the `@auth` tier against the local stack, not hosted.** The panel writes nothing, so reading hosted would be acceptable — but this checkout's `.env` points at hosted production, and the admin account Task 10 provisioned exists only locally. Override the four names in the shell, where they beat `--env-file`:

```bash
pnpm exec supabase start
NEXT_PUBLIC_SUPABASE_URL="$(grep -m1 '^TEST_SUPABASE_URL=' .env.test | cut -d= -f2-)" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(grep -m1 '^TEST_SUPABASE_PUBLISHABLE_KEY=' .env.test | cut -d= -f2-)" \
ADMIN_EMAIL="$(grep -m1 '^TEST_ADMIN_EMAIL=' .env.test 2>/dev/null | cut -d= -f2- || true)" \
  pnpm test:e2e:auth
```

If `TEST_ADMIN_EMAIL` is not a name `.env.test` carries, export `ADMIN_EMAIL=admin@rls-test.local ADMIN_PASSWORD=<FIXTURE_PASSWORD>` inline instead and say in the tracker which pair the run used — the run must be reproducible by whoever reads the line next. Expected: 16 existing passed plus the 5 new.

**The drafted command cannot run this tier, and the tier had never run against the local stack
before.** What it took, in order:

- **The admin pair.** `.env.test` carries four names only (`TEST_SUPABASE_URL`,
  `TEST_SUPABASE_PUBLISHABLE_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_DEMO_PASSWORD`) — no
  `TEST_ADMIN_EMAIL`, so the fallback applies: `ADMIN_EMAIL=admin@rls-test.local` /
  `ADMIN_PASSWORD=test-fixture-password-123`, i.e. `FIXTURE_USERS.admin` with `FIXTURE_PASSWORD`
  from `tests/fixtures/identity-users.ts`. Deliberately the *existing* fixture admin: provisioning a
  second one would break the two last-admin integration cases (Task 10's open decision).
- **Five overrides, not four.** `SUPABASE_SERVICE_ROLE_KEY` has to move with the rest — the metric
  reads go through `getAdminDb()` (RLS bypassed, by design), so leaving it at `.env`'s value would
  read production rows behind a local-stack session. `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  too, or the auth host comes from the hosted `.env`. And the dev server must already be up under
  the same overrides: `webServer.reuseExistingServer` is true off CI, so a cold `pnpm test:e2e:auth`
  starts a *bare* `pnpm dev -p 3000`, which reads `.env` and points the whole tier at hosted.
- **The real blocker was the CSP, not the env.** First run: 9 passed / 16 failed, every failure
  inside `logIn` waiting on `/dashboard`, the dev log showing GETs and no POST. A console-logging
  probe found it: `Connecting to 'http://127.0.0.1:54321/auth/v1/token?grant_type=password'
  violates the following Content Security Policy directive: "connect-src 'self' ws: wss: https:"`.
  `supabase start` serves plain HTTP and the dev policy has never admitted it, so **the `@auth` tier
  has only ever been runnable against hosted** — 16 failures were the tier's local-stack debut, not a
  regression. King chose "allow the local stack in dev": `next.config.ts` now appends
  `http://127.0.0.1:54321 http://localhost:54321` to the dev `connect-src` only, production untouched,
  and the three places that recorded the directive are updated with it
  (`context/code-standards.md`, `context/feature-specs/04-dashboard.md`, `context/progress-tracker.md`).
- **Then the data problem.** 6 still failed: `overview`, `tab-deep-link`, `mobile-layout` ×2,
  `export/csv` and the new menu test — all of them waiting on a dashboard that had painted
  `EmptyShell`. `DEMO_EMAIL=client@a.rls-test.local` is `FIXTURE_USERS.clientA`, tenant "RLS Client
  A", which has **0** rows in `metrics_snapshots` and `current_metrics`; `scripts/seed.mjs` fills
  only its three hard-coded domains. Two local-stack steps fix it: `pnpm db:seed -- --days 90` (the
  existing rows stopped at 2026-09-25, outside the default 7-day window, so even a seeded tenant read
  empty) and `pnpm db:demo-user` with `DEMO_EMAIL=demo@rls-test.local`, which links that account to
  Northstar Studio. **So this tier's demo user is no longer `FIXTURE_USERS.clientA`** — the fixture
  tenants stay untouched for the integration tier, and `@auth` gets its own data-bearing local
  account. Both commands were run with the `TEST_*` names overridden inline, never bare.
- **Result: 26 passed** (9 public + 17 auth — 9 pre-existing and 8 new, not "16 existing plus the 5
  new"). `pnpm test:all` afterwards: 38 files / 240 tests green, which is the evidence that the new
  `demo@rls-test.local` row, Task 11's `pending@rls-test.local` auth account and the fresh snapshots
  disturb neither the RLS cases nor the last-admin ones.

The reproducible form, from a clean shell with the stack up:

```bash
set -a; . ./.env.test; set +a
export NEXT_PUBLIC_SUPABASE_URL="$TEST_SUPABASE_URL" \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$TEST_SUPABASE_PUBLISHABLE_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$TEST_SUPABASE_SERVICE_ROLE_KEY" \
  NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  ADMIN_EMAIL=admin@rls-test.local ADMIN_PASSWORD=test-fixture-password-123 \
  DEMO_EMAIL=demo@rls-test.local DEMO_PASSWORD=test-fixture-password-123
pnpm dev -p 3000 &        # must be up, and up under these names
pnpm test:e2e:auth
```

- [x] **Step 11: Use the page in a browser before calling it done.**

```bash
pnpm dev -p 3000
```

Visit `http://localhost:3000/admin` signed in as the admin fixture: the two regions render, the client table shows every seeded client including any paused one, the Members table shows the admin's own email from the directory, the rail shows three links with none active, and narrowing to 320 px clips the tables inside their own boxes rather than the document. Then visit it signed out (login redirect with `next=%2Fadmin`) and as a `client` account (bounced to `/dashboard`). If any of those four views cannot be exercised locally, say so in the tracker rather than claiming the surface was seen.

Seen in Chrome against the local stack, signed in as `admin@rls-test.local`:

- **Both regions render.** Clients: five rows, `Domain` in mono, `Active` badges, member counts
  0 / 0 / 1 / 2 / 1, disabled Rename and Pause on every row. Members: five rows, `Role` badges,
  `Detach` disabled.
- **The paused state had to be made, because nothing on the stack was inactive.** A direct
  `update public.clients set is_active = false where name = 'Atlas Coffee'` over the local
  connection (`127.0.0.1:54322`) put a `Paused` badge and a `Resume` button on that row — and it is
  the row's *presence* that is the finding: `admin_directory` carries no `is_active` filter, which is
  what lets an admin resume what a tenant can no longer see. Restored to `true` afterwards.
- **The admin's own email is in the Members table**, role `admin`, Client `Unassigned` — from the
  directory, not from the session, which is §6's point.
- **The Step 4 cell fix is visible on this data.** The demo account renders as two lines,
  "Demo User" over `demo@rls-test.local`, because `create-demo-user.mjs` writes
  `user_metadata.name`; the four fixture accounts have no display name and now render one line
  rather than the same email twice.
- **`pending@rls-test.local` is absent from the table, correctly** — it is not provisioned. It is
  what makes `members.pending.length > 0`, which is the only reason the Attach account trigger
  renders at all. Its list lives *inside* that dialog, so while the trigger is disabled a pending
  account has no visible representation beyond the button. Task 12's note.
- **Rail: three links, none active** at 1280, and the destination strip replaces it below `lg`.
  Tables clip inside their own boxes at 320 and 390; `Domain` drops below `sm`.
- **The signed-out and client-role visits were exercised by specs, not by hand**:
  `tests/identity/e2e/admin-guard.spec.ts` (Task 8) asserts the login redirect with `next=%2Fadmin`,
  and `tests/admin/e2e/panel.spec.ts` asserts the bounce. Both run in a real browser.
- One artifact noticed and **not** this panel's: the shell's theme toggle floats bottom-left over
  content at 390 px on `/admin` — and on `/connections` too, so it is the shell's, pre-existing.

- [x] **Step 12: Commit.**

```bash
git add "app/(app)/admin" components/features/admin \
  components/features/user-profile/components/account-menu.tsx \
  tests/helpers/log-in.ts tests/admin/e2e
git commit -m "feat(admin): render the provisioning panel inside the app shell"
```

---

### Task 12: Mutations — dialogs, commit-on-change selects, and refresh only on 2xx

**Files:**
- Create: `components/features/admin/lib/mutations.ts`
- Create: `components/features/admin/lib/select-items.ts`
- Modify: `components/features/admin/components/client-dialog.tsx` (real form)
- Modify: `components/features/admin/components/attach-member-dialog.tsx` (real form)
- Modify: `components/features/admin/components/client-table.tsx` (Rename dialog + Pause button)
- Modify: `components/features/admin/components/member-table.tsx` (role/client Selects + Detach)
- Modify: `components/features/admin/components/admin-panel.tsx` (pass clients into the attach dialog)

**Interfaces:**
- Consumes: the four endpoints from Task 7, `startStatusToast`/`finishStatusToast` (`lib/toast-status.ts:10,17`), base-ui `Select` whose `Root` takes `items`/`value`/`onValueChange`.
- Produces: `createClient(input)`, `updateClient(id, patch)`, `attachMember(id, body)`, `detachMember(id)` — each returning `{ ok: true } | { ok: false; message: string }`.

- [x] **Step 1: Write the mutation client.** Create `components/features/admin/lib/mutations.ts`:

```ts
type Endpoint =
  | ["POST", "/api/admin/clients", unknown]
  | ["PATCH", string, unknown]
  | ["PUT", string, unknown]
  | ["DELETE", string, undefined];

export type MutationResult = { ok: true } | { ok: false; message: string };

async function send(
  method: Endpoint[0],
  path: string,
  body: unknown,
): Promise<MutationResult> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
  if (response.ok) return { ok: true };
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, message: payload?.error ?? "The change did not save." };
}

export function createClient(name: string, domain: string) {
  return send("POST", "/api/admin/clients", { name, domain });
}

export function updateClient(clientId: string, patch: { name?: string; isActive?: boolean }) {
  return send("PATCH", `/api/admin/clients/${clientId}`, patch);
}

export function attachMember(
  userId: string,
  body: { role: string; clientId?: string | null },
) {
  return send("PUT", `/api/admin/members/${userId}`, body);
}

export function detachMember(userId: string) {
  return send("DELETE", `/api/admin/members/${userId}`, undefined);
}
```

`payload?.error` is the server's §7 string and the only copy the UI shows; `"The change did not save."` is the fallback for a non-JSON reply, and it never interpolates the body.

**Deviation (Step 1).** The drafted `Endpoint` union is gone. Each arm paired a method with a path
literal (`["POST", "/api/admin/clients", unknown]`), but every caller builds its own interpolated
path, so `send` was already typed `(Endpoint[0], string, unknown)` and the union constrained only
the first argument. It is now `type Method = "POST" | "PATCH" | "PUT" | "DELETE"`, which says the
same thing in four tokens. One comment is new, above the `response.json()` line: without it a reader
cannot see that the fixed fallback string is deliberate protection against echoing a proxy's HTML
error page into a toast.

- [x] **Step 2: Write the Select data.** Create `components/features/admin/lib/select-items.ts`:

```ts
import { MEMBER_ROLES } from "@/types/metrics";
import type { PanelClient, PendingAccount, ProvisionedMember } from "@/lib/admin/provisioning";

export const UNASSIGNED = "__unassigned__";

export const MEMBER_ROLE_ITEMS: Record<string, string> = Object.fromEntries(
  MEMBER_ROLES.map((role) => [role, role]),
);

export const CLIENT_ITEMS = (clients: PanelClient[]): Record<string, string> => ({
  [UNASSIGNED]: "Unassigned",
  ...Object.fromEntries(clients.map((client) => [client.id, client.name])),
});

/** Accounts the panel may attach, in the order the directory returned them. */
export const ACCOUNT_ITEMS = (
  accounts: PendingAccount[],
): Record<string, string> =>
  Object.fromEntries(
    accounts.map((account) => [
      account.userId,
      account.name ? `${account.name} · ${account.email ?? "no email"}` : (account.email ?? account.userId),
    ]),
  );

export function memberInitialRole(member: ProvisionedMember): string {
  return member.role;
}
```

`Select` needs `items` as a plain record, which is why this is data rather than JSX options. `memberInitialRole` exists only so `member-table` does not re-derive the union — delete it if the component reads `member.role` directly, which it will.

- [x] **Step 3: Make the client dialog a form.** Rewrite `client-dialog.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient, updateClient } from "../lib/mutations";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";

export function ClientDialog({
  mode,
  clientId,
  name = "",
}: {
  mode: "create" | "rename";
  clientId?: string;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [domain, setDomain] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const toastId = startStatusToast(mode === "create" ? "Create client" : "Rename client");
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClient(draft, domain)
          : await updateClient(clientId!, { name: draft });
      if (!result.ok) {
        finishStatusToast(toastId, {
          status: "error",
          title: mode === "create" ? "Could not create the client" : "Could not rename it",
          description: result.message,
        });
        // Dialog stays open with the draft intact: the fix is in the field, not
        // in re-entering the whole form.
        return;
      }
      finishStatusToast(toastId, {
        status: "success",
        title: mode === "create" ? "Client created" : "Client renamed",
        description: mode === "create" ? `${draft} is in the registry.` : `${draft}.`,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={mode === "create" ? "default" : "ghost"} size="sm" />
        }
      >
        {mode === "create" ? "Create client" : "Rename"}
      </DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New client" : "Rename client"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "The domain is fixed once the client exists. Seed scripts key on it."
              : "The domain cannot be changed after creation."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="client-name">
              Name
            </label>
            <Input
              id="client-name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={120}
              required
            />
          </div>
          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="client-domain">
                Domain
              </label>
              <Input
                id="client-domain"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="atlas.example"
                required
              />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

A bare `<form>` with `<label htmlFor>` per `email-auth-form.tsx:98` — no `components/ui/form`, which does not exist and is not added (§5). `maxLength={120}` mirrors the zod bound so the common over-long case is caught in the field and the server's 400 stays a backstop.

- [x] **Step 4: Wire the client table.** Replace the two disabled buttons with `<ClientDialog mode="rename" clientId={client.id} name={client.name} />` and a live Pause/Resume button:

```tsx
const [pending, startTransition] = useTransition();
const [busyId, setBusyId] = useState<string | null>(null);

function toggle(client: PanelClient) {
  setBusyId(client.id);
  const toastId = startStatusToast(client.isActive ? "Pause client" : "Resume client");
  startTransition(async () => {
    const result = await updateClient(client.id, { isActive: !client.isActive });
    setBusyId(null);
    if (!result.ok) {
      finishStatusToast(toastId, {
        status: "error",
        title: client.isActive ? "Could not pause it" : "Could not resume it",
        description: result.message,
      });
      return;
    }
    finishStatusToast(toastId, {
      status: "success",
      title: client.isActive ? "Client paused" : "Client resumed",
      description: `${client.name} is ${client.isActive ? "paused" : "active"}.`,
    });
    router.refresh();
  });
}
```

```tsx
<Button
  variant="outline"
  size="sm"
  disabled={busyId === client.id}
  onClick={() => toggle(client)}
>
  {client.isActive ? "Pause" : "Resume"}
</Button>
```

The row keeps showing `Active`/`Paused` from server data until `refresh()` lands — no optimistic flip (§5), so a refusal leaves the badge truthful.

- [x] **Step 5: Make member rows edit on change.** In `member-table.tsx`, replace the role `Badge` and the disabled Detach with a `Select` per role, a `Select` per client, and a live detach:

```tsx
<Select
  items={MEMBER_ROLE_ITEMS}
  value={member.role}
  onValueChange={(next) => changeRole(member, next)}
  disabled={busyId === member.userId}
>
  <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${member.email ?? member.userId}`}>
    <SelectValue placeholder="Role" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      {MEMBER_ROLES.map((role) => (
        <SelectItem key={role} value={role}>
          {role}
        </SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

```tsx
function changeRole(member: ProvisionedMember, role: string) {
  if (role === member.role) return;
  patch(member, { role, clientId: role === "admin" ? null : member.clientId });
}

async function patch(member: ProvisionedMember, body: { role: string; clientId?: string | null }) {
  setBusyId(member.userId);
  const toastId = startStatusToast("Update member");
  const result = await attachMember(member.userId, body);
  setBusyId(null);
  if (!result.ok) {
    finishStatusToast(toastId, {
      status: "error",
      title: "Change declined",
      description: result.message,
    });
    return;
  }
  finishStatusToast(toastId, {
    status: "success",
    title: "Member updated",
    description: "Saved.",
  });
  router.refresh();
}
```

`changeRole` sends `clientId: null` for an admin because `users_admin_has_no_tenant` would answer `23514` otherwise — and `admin_attach_member` already forces the null, so this only keeps the row's own select from showing a client it no longer has. Verify the exact `Select` subcomponent names and `onValueChange` signature against `components/ui/select.tsx` and one existing consumer before writing; base-ui's `Select` takes `items` on the `Root`, and an unused `Select` in this repo means the first call site has to read the wrapper.

- [x] **Step 6: Rewrite the attach dialog as a real form.** Replace `components/features/admin/components/attach-member-dialog.tsx` entirely. Three fields — which account, which role, which client — and the same submit shape as the client dialog:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import type { PanelClient, PendingAccount } from "@/lib/admin/provisioning";
import { attachMember } from "../lib/mutations";
import {
  ACCOUNT_ITEMS,
  CLIENT_ITEMS,
  MEMBER_ROLE_ITEMS,
  UNASSIGNED,
} from "../lib/select-items";
import { MEMBER_ROLES } from "@/types/metrics";

export function AttachMemberDialog({
  accounts,
  clients,
}: {
  accounts: PendingAccount[];
  clients: PanelClient[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(accounts[0]?.userId ?? "");
  const [role, setRole] = useState<string>("client");
  const [clientId, setClientId] = useState<string>(UNASSIGNED);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const items = ACCOUNT_ITEMS(accounts);
  const clientItems = CLIENT_ITEMS(clients);
  const chosen = accounts.find((account) => account.userId === userId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const toastId = startStatusToast("Attach account");
    startTransition(async () => {
      const result = await attachMember(userId, {
        role,
        clientId: role === "admin" || clientId === UNASSIGNED ? null : clientId,
      });
      if (!result.ok) {
        finishStatusToast(toastId, {
          status: "error",
          title: "Could not attach that account",
          description: result.message,
        });
        return;
      }
      finishStatusToast(toastId, {
        status: "success",
        title: "Account attached",
        description: `${chosen?.email ?? "The account"} is now a ${role}.`,
      });
      setOpen(false);
      router.refresh();
    });
  }

  if (accounts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Attach account</DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Attach account</DialogTitle>
          <DialogDescription>
            {accounts.length} {accounts.length === 1 ? "account has" : "accounts have"}
            signed up without a role. Attaching one gives it a place in the app.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="attach-account">
              Account
            </label>
            <Select
              items={items}
              value={userId}
              onValueChange={(next) => setUserId(next)}
            >
              <SelectTrigger id="attach-account" className="w-full">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {accounts.map((account) => (
                    <SelectItem key={account.userId} value={account.userId}>
                      {account.name
                        ? `${account.name} · ${account.email ?? "no email"}`
                        : (account.email ?? account.userId)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="attach-role">
              Role
            </label>
            <Select
              items={MEMBER_ROLE_ITEMS}
              value={role}
              onValueChange={(next) => setRole(next)}
            >
              <SelectTrigger id="attach-role" className="w-full">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MEMBER_ROLES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="attach-client">
              Client
            </label>
            <Select
              items={clientItems}
              value={clientId}
              onValueChange={(next) => setClientId(next)}
              disabled={role === "admin"}
            >
              <SelectTrigger id="attach-client" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {role === "admin" && (
              <p className="text-xs text-muted-foreground">
                An admin belongs to no client.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || userId === ""}>
              {pending ? "Attaching…" : "Attach"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`if (accounts.length === 0) return null;` is the last line before the markup rather than a first one because hooks must run unconditionally — the empty case is also already gated by `admin-panel.tsx`, so this only protects against a caller that forgets. `disabled={role === "admin"}` plus the one-line note is the only place the UI states the DDL rule; it does not re-implement it, since the button would still work if `users_admin_has_no_tenant` ever changed and the server would still decide.

- [x] **Step 7: Pass the clients down.** Change `admin-panel.tsx`'s call site to `<AttachMemberDialog accounts={members.pending} clients={clients} />`. Nothing else in that file changes in this step.


- [x] **Step 8: Test the mutation results in the unit tier.** `@auth` stays read-only (§8), so nothing in a browser presses these buttons; the pure request/response contract still gets pinned. Create `tests/admin/unit/mutations.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachMember, createClient, detachMember, updateClient } from "@/components/features/admin/lib/mutations";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

describe("admin mutations", () => {
  it("shows the server's string, unchanged", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Assign another admin before removing this one." }), {
        status: 409,
      }),
    );
    await expect(updateClient("7", { isActive: false })).resolves.toEqual({
      ok: false,
      message: "Assign another admin before removing this one.",
    });
  });

  it("falls back without interpolating the body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(createClient("Atlas", "atlas.example")).resolves.toEqual({
      ok: false,
      message: "The change did not save.",
    });
  });

  it("sends no body or content-type on DELETE", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await expect(detachMember("7")).resolves.toEqual({ ok: true });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/admin/members/7");
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({});
  });

  it("sends clientId null so 'Unassigned' is addressable", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await attachMember("7", { role: "client", clientId: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      role: "client",
      clientId: null,
    });
  });

  it("reports a network failure as a message, not a throw", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));
    await expect(updateClient("7", { name: "Atlas" })).resolves.toEqual({
      ok: false,
      message: "Could not reach the server.",
    });
  });
});
```

Run: `pnpm test admin`
Expected: every admin unit file green. If the unit project refuses to import a `"use client"` module, add `components/features/admin/lib/mutations.ts` to the same alias set the other client-adjacent lib tests use — check how `tests/dashboard/unit/*` imports anything under `components/features/dashboard/lib` before inventing a config change.

`pnpm test admin`: 10 files / 65 tests green. The refusal the second sentence guards against did not
happen, so no config changed — the unit project already consumes `"use client"` libs through the
`@` alias (`tests/identity/unit/profile.test.ts:23` imports `components/features/user-profile/lib`
the same way). The five cases ship verbatim.

**Deviations (Steps 3-7).**
- **`client-table.tsx` and `member-table.tsx` needed `"use client"`.** The plan's Step 4/5 snippets
  add `useState`, `useTransition` and `onClick`, none of which survive in a server component; Task 11
  shipped both files without the directive because they were pure renders. Both now carry it.
- **Per-row field ids in the rename dialog.** The drafted `id="client-name"` is fine in one create
  dialog and wrong in six rename dialogs on one page — `label htmlFor` would bind to the first row's
  input. `client-dialog.tsx` derives `client-name-${clientId ?? "new"}` instead. `evaluate_script`
  afterwards showed base-ui mounts dialog content lazily (only the open dialog's fields are in the
  DOM, `dangling: []`), so this is correctness insurance rather than a bug a user could see.
- **Every `onValueChange` guards a null.** The drafted `onValueChange={(next) => setUserId(next)}`
  does not typecheck: base-ui's handler is `(value: Value | null, details) => void`
  (`node_modules/@base-ui/react/esm/select/root/SelectRoot.d.ts:51` region), and `dashboard-header.tsx:53-79`
  — the precedent the plan cites — already guards. Each of the three member/attach selects opens with
  `if (!next) return;`.
- **Step 7's "Nothing else in that file changes in this step" is false.** `MemberTable` renders a
  client `Select` per row (Step 5), so `admin-panel.tsx`'s call site became
  `<MemberTable members={members.provisioned} clients={clients} />` in the same step.
- **`UNASSIGNED` is a sentinel, not a nullable value.** base-ui holds one item value and cannot key an
  option by `null`, so the "no client" option is `"__unassigned__"` in the DOM and mapped back to
  `null` in the two places that build a request body. Documented on the constant.

- [x] **Step 9: Drive it in the browser, then stop.** Writes make this the task where the panel must actually be clicked, against the local stack (Task 11 Step 10's overrides; never hosted):

```bash
pnpm dev -p 3000
```

Create a client → it appears with its domain lowercased. Rename it. Pause it — and confirm it **stays in the table** with `Paused` (deviation 1's whole reason for existing). Resume it. Attach a pending account, then demote it and confirm the last-admin refusal toast leaves the badge untouched. Detach a scratch member twice from two tabs and read `That account is not provisioned.` on the second. Sign out and back in as a `client`, open `/admin`, and land on `/dashboard`.

Driven in Chrome against the local stack, signed in as `admin@rls-test.local`, every leg clicked by
hand because `@auth` stays read-only:

- **Create** with `SCRATCH.example/` and a name → the row lands as `scratch.example`, so the server's
  normalization is what the table shows, not what was typed. **Rename** to "Scratch Studio" → the
  cell changed and the toast read `Scratch Studio.` **Pause** → the row **stayed**, badge `Paused`,
  button flipped to `Resume` — deviation 1 confirmed from the UI, not only from the SQL. **Resume**
  restored it.
- **Commit-on-change**: the demo member's client Select moved Northstar → Scratch on a single change
  event, and both member counts followed on the refresh (Northstar 2→1, Scratch 0→1) — the write and
  the read agree without a submit button.
- **Last-admin refusal**: switching the admin's own role to `client` produced `Change declined` /
  `Assign another admin before removing this one.`, the select snapped back to `admin` on its own
  (no `router.refresh()` on a non-2xx), and `psql` confirmed `role = admin` with `admins = 1`.
- **Attach**: the dialog's admin branch disabled the client Select and showed `An admin belongs to no
  client.`; `pending@rls-test.local` was then attached as `client` of Scratch Studio, which emptied
  the pending list — the Attach trigger disappeared and the region read `Every account is already
  provisioned.` Promoting that account to `admin` took Scratch from 2 to 1 member, and its client
  Select went disabled.
- **Two tabs, one detach**: detached in tab 3 (toast `Account detached`), then pressed the same
  Detach in tab 4, still holding the stale row → `Could not detach it` /
  `That account is not provisioned.`, and the stale row stayed put. That is §7's real-sentence path
  reached through an actual stale session rather than a mock.
- **Duplicate domain**: creating a second client on `northstar.example` gave `Could not create the
  client` / `Another client already owns that domain.` **with the dialog still open and both drafts
  intact** — Step 3's "failure keeps the form" branch.
- **Client-role bounce**: signed out and back in as `client@a.rls-test.local`, opened `/admin`, and
  landed on `/dashboard?client=254c0249-…` — RLS Client A, their own tenant, chosen by the read
  rather than by a redirect with a hard-coded target. `/admin` renders no header (the AccountMenu
  lives in the dashboard's own shell), so the sign-out leg runs from `/dashboard`; that gap is
  Task 13's, not this task's.
- **Two bugs only the browser showed.** (i) `{"1 account"} hassigned up…` — JSX trims the newline
  between an expression and the text after it, so the pluralization branch rendered `1 account has`
  glued to the next sentence; the copy is now one template literal. (ii) With role switched to
  `admin`, the now-disabled client Select still displayed `Scratch Studio`, a value the write would
  ignore; `onValueChange` clears it to `UNASSIGNED` on that transition. Neither is visible in a
  unit test, and both are recorded in `context/code-standards.md`.
- **Stack restored**: Demo User moved back to Northstar Studio, `scratch.example` deleted over the
  local `psql` connection (`DELETE 1`), `pending@rls-test.local` left unprovisioned (its auth account
  stays, which is what keeps the Attach trigger honest in later runs), `admins = 1`, five clients.

- [ ] **Step 10: Gate and commit.**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e && pnpm test:e2e:auth`
Expected: green throughout, `ƒ /admin` and `○ /dashboard`, and `@auth` still 16 + 5 passed with the local stack up.

Green throughout, with the local stack up and `pnpm dev -p 3000` running under Task 11 Step 10's
overrides: **36 files / 226 tests** (`pnpm test`), `typecheck` and `lint` silent, `pnpm build`
printing `ƒ /admin`, the three `/api/admin/*` routes `ƒ`, and `○ /dashboard` still prerendered,
**9 passed** public and **26 passed** auth. The "16 + 5" in the Expected line is stale the same way
Task 11's was: `playwright test --project auth --list` reports **26 tests in 12 files**, because the
admin layout spec multiplies across viewports. 226 unit + 14 integration = the 240 `pnpm test:all`
records.

```bash
git add components/features/admin tests/admin/unit/mutations.test.ts
git commit -m "feat(admin): wire the provisioning mutations with commit-on-change rows"
```

---

### Task 13: Make the documents true, then hand the branch over

Five files now describe a system that exists and one that does not. `RULES.md` §14 and the "Editing this file" section of `AGENTS.md` both require the update to ship in the same change as the code.

**Files:**
- Modify: `AGENTS.md`
- Modify: `context/feature-specs/08-app-shell.md` (`:21-23`)
- Modify: `docs/target-state.md` (step 12)
- Modify: `context/progress-tracker.md`
- Modify: `context/architecture-context.md` (only if it states there is no admin write path)

**Interfaces:**
- Consumes: every task above, and the observed gate output from Step 5.
- Produces: a tree in which `AGENTS.md` and the code agree, which is the artifact the user's portfolio work is actually judged on.

- [x] **Step 1: `AGENTS.md`, four edits.**
  - Request-path diagram: add `  → app/(app)/admin/page.tsx — server component; requireAdmin() then getAdminView(), writes go over /api/admin/*`.
  - HTTP surface table, four rows, copying `/connections`' shape for the page row:

```
| `/admin` (page) | GET | session + `requireAdmin()` | server page in the `app/(app)/` group; renders clients + members; redirects a non-admin to `/dashboard` |
| `/api/admin/clients` | POST | session + `requireAdmin()` | `admin_create_client()` definer RPC; user-scoped client |
| `/api/admin/clients/[clientId]` | PATCH | session + `requireAdmin()` | `admin_update_client()`; name and/or `is_active`, never domain |
| `/api/admin/members/[userId]` | PUT / DELETE | session + `requireAdmin()` | `admin_attach_member()` / `admin_detach_member()`; the last admin cannot be removed |
```

  - "Pages and caching": delete the sentence `There is **no** admin panel page` and state the new fact — `app/(app)/admin/` exists, is `ƒ`, and the shell still reads no session so `/dashboard` stays `○`. Add one line to the tenant-isolation paragraph: *admin writes go through `public` definer RPCs called with the user-scoped client, never table grants and never `getAdminDb()`; the guard is the first statement in each function.*
  - Test-folder table: add an `admin` row owning `lib/admin/*`, `components/features/admin`, `/api/admin/*`, `app/(app)/admin/`, and `tests/admin/integration/provisioning.test.ts` — and note the guard spec that lives in `identity` because `lib/auth/routing` does.

- [x] **Step 2: Rewrite the app-shell non-goal.** Replace `context/feature-specs/08-app-shell.md:21-23` ("Role-gated destinations… The admin panel adds its row and the filter together.") with:

```markdown
- Role-gated destinations. A `visibleDestinations(role)` filter still has zero callers: the rail
  renders three destinations for everyone, and `/admin` reached `AccountMenu` instead of the rail.
  What changed since this was written: `/admin` is now a real page the shell wraps, and
  `activeDestination("/admin")` returns `null`, so the rail renders beside it with **no row
  marked active**. That is a state, not an oversight — the shell cannot read a session without
  making `/dashboard` dynamic, and marking the Dashboard row active on an admin page would be a
  lie the rail tells on purpose. Reading the session here is the one edit that would make the
  filter worth having, and it is still the edit this file forbids.
```

- [x] **Step 3: Downgrade target-state step 12** (deviation 6). Replace it with:

```
12. ⚠️ Admin panel: provisioning shipped 2026-10-05 (`/admin`, five definer RPCs). Sync logs, credential writes and a manual sync trigger are still absent — nothing consumes the `seo-sync` queue.
```

- [x] **Step 4: Move the tracker entry to Completed.** Delete the In Progress bullet from Task 1 and append to `## Recent Work` (or `## Completed`, matching the file's existing convention — read which one the `/connections` entry sits under and follow it):

```markdown
- **Admin panel: provisioning** (2026-10-05) — `/admin` inside the app shell, entered from `AccountMenu`.
  Five `public` `security definer` RPCs (`admin_directory`, `admin_create_client`, `admin_update_client`,
  `admin_attach_member`, `admin_detach_member`) called with the **user-scoped** client; zero new table
  grants; `pg_advisory_xact_lock(800100)` and reserved codes `45001`/`45002` guard the last admin.
  Migration `20261005000000_admin_provisioning.sql` applied to the **local stack only** — hosted is a
  separate yes.
  - `<the gate lines, verbatim from Step 5's output: test/typecheck/lint/build tallies, the `ƒ /admin` + `○ /dashboard` route lines, integration passed/skipped split, both e2e tallies>`
  - Definer read of `auth.users`: `<verdict>`; nested caller role: `<verdict>`; directory cap: `<measured | inherited>`.
  - What this does not prove: no browser spec writes (`@auth` is read-only by decision), so nothing
    asserts that pressing *Create client* in a browser round-trips; the mutation contract is pinned in
    `tests/admin/unit/mutations.test.ts` and the writes in the integration tier.
```

Quote what the commands printed. Do not transcribe a number from this plan.

- [x] **Step 5: Final gate, in one block, and record it.**

```bash
pnpm exec supabase start
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm test:integration
pnpm test:e2e
pnpm test:e2e:auth      # with Task 11 Step 10's local-stack overrides in the shell
```

Expected: unit tier ≥ `26` files and `160` baseline tests plus the new admin files, all passed; `tsc --noEmit` silent; lint silent; build route table shows `ƒ /admin` and `○ /dashboard`; integration `3` files green (`18` tests: 5 + 4 + 9) with the local stack up; `test:e2e` `7` passed; `test:e2e:auth` `21` passed. Copy the real numbers into the tracker.

Run 2026-10-06 with the local stack up and `pnpm dev -p 3000` under Task 11 Step 10's overrides. Every
line below is what the commands printed, not what this paragraph predicted — the predictions are stale
in the same direction as Task 11's were:

```
pnpm test              Test Files  36 passed (36)   Tests  226 passed (226)
pnpm typecheck         ✓ Types generated successfully   (tsc --noEmit silent)
pnpm lint              (no output)
pnpm build             ✓ Compiled successfully   ƒ /admin  ƒ /api/admin/clients
                                                          ƒ /api/admin/clients/[clientId]
                                                          ƒ /api/admin/members/[userId]
                       ○ /dashboard
pnpm test:integration  Test Files   3 passed  (3)    Tests   19 passed (19)
pnpm test:e2e             9 passed (3.4s)
pnpm test:e2e:auth       26 passed (17.4s)
pnpm test:all          Test Files  39 passed (39)   Tests  245 passed (245)
```

**Deviations (Steps 1-4).**
- **Step 1's third edit targeted a sentence that no longer exists.** "There is **no** admin panel page"
  was removed by Task 11, which rewrote that paragraph when the page shipped. The duty is still done:
  the caching paragraph now states that `/admin` carries `force-dynamic` for the same cookie-bound
  reason as `/connections`, that the shell reads no session which is *why* the rail cannot mark a row
  active there, and that panel writes are `fetch` → `router.refresh()` only on a 2xx.
- **`context/architecture-context.md` needed four edits, not the conditional one.** Its "only if it
  states there is no admin write path" guard was satisfied three times over: "No admin panel yet",
  "`requireAdmin()` … **no route calls it yet**", and "Seven route handlers exist". All three are now
  false against the code, so the file also gained `lib/admin` in the module list, the new migration in
  the migrations list, `/admin` in the routing-table line, and a paragraph distinguishing the admin
  handlers' order (guard → uuid → body → zod → RPC → code→status) from the tenant-scoped reads'.
- **`docs/target-state.md` step 12 is `⚠️`, not `✅`,** and dated 2026-10-06 (the day the work landed)
  rather than the draft's 2026-10-05 (the spec's date).
- **Step 4 went to `## Recent Work`,** which is where the `/connections` feature entry lives — the
  convention the step asked to be read rather than assumed. `## In Progress` keeps a three-line pointer
  and names the two decisions the slice left open, now numbered 10 and 11 under `## Open Questions`;
  `## Current Phase` and `## Current Goal` both changed, since they are the state of record and were
  still describing 2026-09-25.

- [x] **Step 6: Commit.**

```bash
git add AGENTS.md context/feature-specs/08-app-shell.md docs/target-state.md \
  context/progress-tracker.md context/architecture-context.md
git commit -m "docs: record the admin provisioning slice in the files that describe the surface"
```

Ran as `fbb013b` with this plan file added to the list, so the ticks and the Deviations block travel
with the surface docs they describe: 6 files, 173 insertions, 184 deletions, no code.

- [x] **Step 7: Stop. Do not push.** The branch is `feat/app-shell-connections`; pushing, opening a
PR, and applying the migration to the hosted project are three separate yeses from the user
(`RULES.md` §7, §16). Report the gate tallies and the one line the hosted migration would need.

**Overridden by the user on 2026-10-08: "commit and push this so we can create a PR."** The gate
tallies were reported first (Step 5's transcript), then `fbb013b` was pushed to
`feat/app-shell-connections`, `feat/admin-provisioning` was created at that same commit and pushed,
and **draft PR #21** (`feat/admin-provisioning` → `main`) was opened — draft per
`context/pm-conventions.md` ("Draft until green"), because `pm-conventions.md:24` wants a rebase
before pushing and none was needed: `git diff --stat HEAD...origin/main` printed nothing, so `main`'s
two extra commits are the merge commits of PR #19 and #20 and no content diverged.
`gh pr view` reports `MERGEABLE`.

**The third yes was spent on 2026-10-08,** when King asked for an admin he could manual-test with (the
date above is this session's continuation day, not the probe's). Measured on hosted before the apply:
a read-only `pg_proc` query against `SUPABASE_DB_URL` returned `[]` for `admin_%` and
`public.schema_migrations` stopped at `20260925000000_connections_read.sql`, so `/admin` could not
render there — while `dummydump01@gmail.com` was **already** `role = 'admin'` with `client_id = null`,
which is to say the missing capability was the SQL, not the account. A dry check found exactly one
pending migration, then `pnpm db:migrate` (against the project `.env` names; no `.env.local` exists)
printed `apply 20261005000000_admin_provisioning.sql` / `Applied 1 migration(s).` Read back on hosted:
5 functions with `prosecdef = true`, `EXECUTE` for `authenticated`, and an anonymous
`POST /rest/v1/rpc/admin_directory` answering **401 / `42501` permission denied for function
admin_directory**. So `/admin` now works against hosted data from any checkout that carries this code —
`main` does not yet, which leaves merging PR #21 as the last step to make it reachable on the deployed
site.

---

## Self-review

**1. Spec coverage.** §0's four corrections → Tasks 3 (public schema), 5 (code-preserving wrapper, tested at the boundary that broke), 10 (plain `ADMIN_*`, pinned by a test), 3+9 (`raw_user_meta_data ->> 'name'` and the merge that depends on it). §1's inert-signup gap → Task 9's `pending` list and Task 12's attach. §2's exclusions → the spec file written in Task 1 and no task that contradicts them. §3's five functions, guard, lock, codes → Task 3. §4's three route files, four verbs, five-line order, both gates, the AccountMenu entry and its one-way-door framing → Tasks 7, 8, 11. §5's tree, `lib/admin/*` holding no React, stacked regions, commit-on-change, no new `components/ui/*`, the phone-width clipper → Tasks 4, 5, 11, 12. §6's merge and "email comes from the directory" → Task 9. §7's status map and every empty state → Tasks 4, 7, 11; "refresh only on 2xx" → Task 12. §8's four tiers, the `identity` placement of the guard case, `@auth` read-only, and the TDD order (probes → error map → migration → routes → page) → Tasks 2, 4, 3, 7, 11. §9's `--admin`, the truncation guard, and all five doc duties → Tasks 10, 1, 13. §10's two probes → Tasks 2 and 11 Step 9. §11's three open questions are questions, not requirements — none is silently answered; Task 12's `45001` toast is the stance §11.3 records.

**2. Placeholder scan.** Angle brackets appear only in tracker-reporting slots that a human fills from observed command output, and never in code. Every code step carries real code; the four places that say *verify against the real file* (`components/ui/select.tsx` in Task 12 Steps 5-6, `DialogTrigger` in Task 11 Step 5, the `createServerSupabaseClient` path in Task 5 Step 3, the existing `connections-guard.spec.ts` shape in Task 8 Step 3) are checks against code this plan deliberately does not transcribe — `RULES.md` §17 protects `components/ui/*` and `lib/supabase/*` from edit, so their exact prop names have to be read at the moment of use. Each names the file to read and the assumption to test, which is not a TODO.

**3. Type consistency.** `AdminRpcError { code?: string; functionName }` is constructed in Task 5 and caught in Task 7 the same way. `adminErrorStatus(code: string | undefined)` and `adminErrorMessage(rpc: AdminWriteRpc, code)` match Task 4's test, Task 5's class, and all four handlers. `MEMBER_ROLES`/`MemberRole` are defined once in Task 4 and consumed by `lib/admin/schemas.ts`, `types/database.ts`, `lib/admin/provisioning.ts`, and `select-items.ts`. `getAdminView()`'s `AdminView` is the page's prop type in Task 11 and the argument shape of `buildMemberViews`/`withMemberCounts` in Task 9; `PanelClient.isActive` is the only `isActive` in the read path, while `updateClient`'s patch key is also `isActive` and maps to `p_is_active` at the handler — one name per side, converted exactly once. `attachMember(userId, { role, clientId })` appears identically in Task 12 Steps 1, 5, and 6. The route paths in `mutations.ts` are the paths created in Task 7.

