# Unit 3 — make `credential_reference` unselectable by a tenant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postgres — not a comment in a migration — decides that a logged-in tenant cannot read `public.api_credentials.credential_reference`, while `/connections` keeps reading `client_id`, `source`, `created_at`.

**Architecture:** One new timestamped migration narrows the `authenticated` privilege on `api_credentials` from table-wide `select` to the three status columns. The proof lives in the existing live-RLS integration file, which drives a real session through PostgREST and so is the only place a column privilege can be observed rather than asserted. Nothing in `lib/` changes: the tenant rule stays row-level, and `lib/api/guard.ts` already forwards to the two RLS probes.

**Tech Stack:** PostgreSQL 17 (Supabase local stack), `@supabase/ssr` + PostgREST, Vitest `integration` project, pnpm, psql (`/opt/homebrew/opt/postgresql@17/bin/psql`).

**Spec:** `docs/superpowers/specs/2026-10-10-api-hardening-design.md` §126-148. Units 1 and 2 of that spec shipped as PR #24 and PR #25; this plan is the third and last unit, and it is its own branch and PR (`context/pm-conventions.md`: "No grab-bag PRs").

## Global Constraints

- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` green before the change is called complete (`RULES.md` §13). `pnpm test` is the **unit** project only; the live proof is `pnpm test:integration`.
- A green integration tier can mean *nothing ran*: both files `skipIf(!TEST_SUPABASE_URL)`. **Read the passed/skipped counts** (`RULES.md` §13).
- **Never run a `db:*` script bare on this checkout.** `.env` sets `SUPABASE_DB_URL` to the hosted production database and there is no `.env.local` shadowing it. Every DB command in this plan prefixes an explicit local URL (`RULES.md` §16).
- Never edit an applied migration. `20260925000000_connections_read.sql:21` stays exactly as it is; the correction is a new file plus doc edits (`RULES.md` §16).
- `credential_reference` never appears in a response, log line, or cache entry. The three status columns (`client_id`, `source`, `created_at`) may (`RULES.md` §16).
- No commit, push, PR, or hosted migration without King asking for it in this unit. Hosted apply is explicitly **out of scope** — local stack only.
- Tenant isolation is RLS's job: no TypeScript in this change may ask "is this the caller's client?" (`RULES.md` §15).
- Conventional commit prefixes, one logical change per commit (`context/pm-conventions.md`).

## Hypothesis that decides the shape of the migration

The spec expected `revoke select (credential_reference) …` to be the working form and flagged it as unverified. **Read of the Postgres privilege model, unverified until Task 3 prints it:** a table-level `GRANT SELECT` sets both the table bit and the per-column bits, and access is allowed if *either* is present — so a bare column `REVOKE` under a surviving table-wide grant is expected to be a **no-op**, and the form expected to work is revoke-the-table-grant-then-grant-three-columns. Task 3 tests both inside a rolled-back transaction and the migration is written from what Postgres prints, not from this paragraph. If both forms leave the column readable, stop and report — the spec's third option (a `private` view, or leave the column and record why) becomes the decision, and that is King's call, not an implementation detail.

## File structure

| File | Action | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20261010000000_credential_reference_unselectable.sql` | Create | The privilege narrowing, with the why. Filename kept from spec §128 so the doc and the file point at each other. |
| `tests/tenant-isolation/integration/credentials-visibility.test.ts` | Modify | The live proof: three status columns readable, reference denied, per role. |
| `context/feature-specs/09-connections.md` | Modify | §"Accepted limitations" line 36-39 stops being a limitation. |
| `AGENTS.md` | Modify | The hand-maintained block that records the column as selectable. |
| `docs/target-state.md` | Modify | The forward constraint for the sync worker. |
| `context/architecture-context.md` | Modify | Storage/invariants if it records the grant. |
| `context/progress-tracker.md` | Modify | Current Phase / In Progress / Recent Work / Open Questions. |

No new modules. `lib/db/repository.ts:327-343` (`listConnections`) is unchanged — it already selects only the three columns.

---

### Task 1: Local stack up, migrations applied to the local database, baseline printed

**Files:**
- Read: `supabase/config.toml:32-34` (local db port `54322`)
- No repo file changes in this task.

**Interfaces:**
- Produces: a running local stack answering `TEST_SUPABASE_URL` (`http://127.0.0.1:54321`), a local database whose `public.schema_migrations` holds the five applied files, and a printed `has_column_privilege` baseline that Task 2's failing test is measured against.

- [ ] **Step 1: Start Docker Desktop and wait for the daemon.** Docker is installed (`/Applications/Docker.app`, `docker` on PATH) but the daemon is **not running** — `docker info` fails today. Starting it is an action on King's machine: ask before running `open -a Docker`, and confirm with `docker info >/dev/null && echo up`.

- [ ] **Step 2: Start the local Supabase stack.**

```bash
pnpm exec supabase start
pnpm exec supabase status
```

Expected: `API URL: http://127.0.0.1:54321`, db on `54322`. If containers already exist, `supabase start` reuses them — it does not wipe data.

- [ ] **Step 3: Confirm `.env.test` names are present. Names only, never values (`RULES.md` §6).**

```bash
grep -oE '^[A-Z_.]+' .env.test
```

Expected: `TEST_SUPABASE_URL TEST_SUPABASE_PUBLISHABLE_KEY TEST_SUPABASE_SERVICE_ROLE_KEY TEST_DEMO_PASSWORD`.

- [ ] **Step 4: Apply the existing migrations to the LOCAL database, explicitly.**

```bash
SUPABASE_DB_URL="postgres://postgres:postgres@127.0.0.1:54322/postgres" pnpm db:migrate
```

Expected: five `skip` lines (already applied) and `Skipped 5 migration(s)` / no `apply`. Any `apply 2026…` line means the local DB was behind — fine, note which. A `hosted`-looking URL in the printed connection means Step 4 was run bare: stop, re-run with the prefix.

- [ ] **Step 5: Print the baseline — the gap in numbers.**

```bash
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -X -c \
  "select has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'credential_reference', 'select') as reference_readable, has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'client_id', 'select') as client_id_readable;"
```

Expected: `t | t`. That `t` in the first column **is the finding**. Record it verbatim — it goes in the PR body as the before state.

- [ ] **Step 6: No commit** (nothing changed in the tree). Report the printed row instead.

---

### Task 2: The failing live test — a tenant must not read the reference

**Files:**
- Modify: `tests/tenant-isolation/integration/credentials-visibility.test.ts` (add one helper and two cases inside the existing `describe.skipIf(!hasTestDb)` block)

**Interfaces:**
- Consumes: `withSession`, `FIXTURE_USERS`, `provisionFixtures`, `getCurrentCookieStore` from `tests/fixtures/identity-users.ts`; `hasTestDb` from `tests/helpers/db.ts`; the module-level `COLUMNS = "client_id,source,created_at"` already at line 27.
- Produces: `selectAs(email: string, columns: string): Promise<void>` — a helper the Task 4 proof calls, which throws `Database operation failed` for any PostgREST error. Keeps the file's existing convention of throwing that one message rather than leaking provider text.

- [ ] **Step 1: Add the helper, directly under the existing `credentials()` function (line 53).**

```ts
  // Same session path as credentials(), but naming whichever columns the test
  // asks for. A column Postgres has stopped granting comes back as a
  // PostgREST error, and databaseOperation()'s message is the one the rest of
  // this file already asserts.
  async function selectAs(email: string, columns: string): Promise<void> {
    await withSession(email, async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      const db = await createServerSupabaseClient();
      const { error } = await db.from("api_credentials").select(columns);
      if (error) throw new Error("Database operation failed");
    });
  }
```

- [ ] **Step 2: Add the two cases before the closing `});` of the describe block (after the cookie-less case, line 87).**

```ts
  it("a tenant reads the three status columns and nothing else", async () => {
    // The positive half of the pair: whatever Task 4 does to the grant, this
    // page's own read must keep working. /connections selects exactly these.
    await expect(
      selectAs(FIXTURE_USERS.clientA, COLUMNS),
    ).resolves.toBeUndefined();
  });

  it("a tenant cannot select credential_reference at the database", async () => {
    // The point of the unit. Not "the app never asks for it" — that is
    // tests/tenant-isolation/unit/connections-read.test.ts:113 — but "asking
    // for it is refused by Postgres", which only a live session can show.
    await expect(
      selectAs(FIXTURE_USERS.clientA, "credential_reference"),
    ).rejects.toThrow("Database operation failed");
  });
```

- [ ] **Step 3: Run it and watch it fail for the right reason.**

```bash
pnpm test:integration
```

Corrected as written: Expected `1 failed / 20 passed (21)`. The plan first said `1 failed / 10 passed`, counting only `rls-gate.test.ts` (5) and this file (4→6) — but the `integration` project is `tests/*/integration/**/*.test.ts` (`vitest.config.ts:33`), which also runs `tests/admin/integration/provisioning.test.ts` (10 tests). So the tier is 21 tests, and `RULES.md` §13's "two live-RLS files with 9 tests" is stale for the same reason; Task 6 fixes that line (`RULES.md` §10: code is truth, the doc is the defect). the failure landing on the reference case as `Rejected promise expected to throw` or an `AssertionError` — i.e. the select **succeeded**, which is the gap. If the run prints `11 skipped` or any skipped count, the stack from Task 1 is down: fix that before believing anything here.

- [ ] **Step 4: Also confirm the positive case passes** (same run, `a tenant reads the three status columns` → pass). If both fail, the helper's error path is wrong, not the grant.

- [ ] **Step 5: Commit the red test.**

```bash
git add tests/tenant-isolation/integration/credentials-visibility.test.ts
git commit -m "test(tenant-isolation): assert Postgres denies a tenant the credential reference"
```

---

### Task 3: Decide the mechanism at Postgres, in a transaction that leaves nothing behind

**Files:**
- None. This task changes no repo file and mutates no persisted state — every `psql` run is `begin; … rollback;`.

**Interfaces:**
- Consumes: the local database from Task 1.
- Produces: the one SQL form that flips `has_column_privilege(...'credential_reference'...)` to `f` while keeping the three status columns `t`. Task 4 pastes that form into the migration verbatim.

- [ ] **Step 1: Probe form A — the bare column revoke the spec expected.**

```bash
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
revoke select (credential_reference) on public.api_credentials from authenticated;
select has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'credential_reference', 'select') as reference_readable,
       has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'client_id', 'select') as client_id_readable;
select privilege_type from aclexplode((select relacl from pg_class where oid = 'public.api_credentials'::regclass)) where grantee = 'authenticated'::regrole;
rollback;
SQL
```

Read the first row. `f | t` → form A works, use it. `t | t` → form A is inert, as the hypothesis expects; go to Step 2.

- [ ] **Step 2: Probe form B — narrow the grant to the columns the page reads.**

```bash
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
revoke select on public.api_credentials from authenticated;
grant select (client_id, source, created_at) on public.api_credentials to authenticated;
select has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'credential_reference', 'select') as reference_readable,
       has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'client_id', 'select') as client_id_readable,
       has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'id', 'select') as id_readable;
rollback;
SQL
```

Expected: `f | t | f`. `id_readable = f` is correct and wanted — nothing in the app selects `api_credentials.id` (`grep -n 'from("api_credentials")' -A2 lib/db/repository.ts` prints one read, naming three columns).

- [ ] **Step 3: If neither form prints `f` for the reference,** stop. Do not improvise a third form in the migration. The spec's fallback is a `private` view over the three status columns, and that is a wider change than this unit — report the prints and let King choose between the view and leaving the column with the reason recorded.

- [ ] **Step 4: Sanity-check the surviving policy still works under form B** — the RLS `using` expression names `api_credentials.client_id`, so confirm in the same transaction that a tenant read is still row-filtered and not merely column-limited. Postgres evaluates policy expressions without requiring the invoking role to hold `select` on every referenced column; if Task 4's live test disagrees, believe the test.

- [ ] **Step 5: No commit.** Record both printed rows in the message you give King; the winning one is re-stated in the migration header.

---

### Task 4: Write the migration, apply it locally, turn the test green

**Files:**
- Create: `supabase/migrations/20261010000000_credential_reference_unselectable.sql`
- Test: `tests/tenant-isolation/integration/credentials-visibility.test.ts`

**Interfaces:**
- Consumes: the winning SQL form from Task 3.
- Produces: local `public.schema_migrations` gains row `20261010000000_credential_reference_unselectable.sql`; `authenticated` holds `select` on `api_credentials` for `client_id`, `source`, `created_at` only.

- [ ] **Step 1: Write the file.** Header comment carries the why and the non-edit rule, in the voice the other migrations use. This is form B; substitute form A's single `revoke` line if Task 3 printed `f | t` for it.

```sql
-- The Connections page reports which sources a tenant linked, so it needs
-- client_id, source and created_at. It never needs credential_reference, and
-- until now nothing stopped a tenant from asking for it: RLS policies are
-- row-level, so a tenant who can see the row could select any column of it.
-- The reference is an opaque Vault pointer with no key material in it, so this
-- is defence in depth rather than a leak closing -- but it is the shape a real
-- credential write would inherit, and the sync worker is next.
--
-- 20260925000000_connections_read.sql:21 stays as it was: applied migrations
-- are never rewritten (RULES.md §16). This file supersedes it.
--
-- Consequence worth knowing: authenticated can no longer `select *` from this
-- table. Nothing does -- listConnections names the three columns and
-- tests/tenant-isolation/unit/connections-read.test.ts pins that.
revoke select on public.api_credentials from authenticated;

grant select (client_id, source, created_at) on public.api_credentials to authenticated;
```

- [ ] **Step 2: Apply to the local database only, URL explicit.**

```bash
SUPABASE_DB_URL="postgres://postgres:postgres@127.0.0.1:54322/postgres" pnpm db:migrate
```

Expected: `apply 20261010000000_credential_reference_unselectable.sql`, five skips, `Applied 1 migration(s)`.

- [ ] **Step 3: Re-run the integration tier.**

```bash
pnpm test:integration
```

Expected: `21 passed (21)` — this file's 6, `rls-gate.test.ts`'s 5, and
`tests/admin/integration/provisioning.test.ts`'s 10 — and **0 skipped**. Quote both numbers;
`no tests` printed as green is a failure of this step, not a pass (the project runs with
`--passWithNoTests`, `package.json:12`).

- [ ] **Step 4: Re-check the baseline command from Task 1 Step 5 against the real (non-transactional) state.**

```bash
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -X -c \
  "select has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'credential_reference', 'select') as reference_readable, has_column_privilege('authenticated'::regrole, 'public.api_credentials'::regclass, 'created_at', 'select') as created_at_readable;"
```

Expected: `f | t`. This is the after state that pairs with Task 1 Step 5's before state.

- [ ] **Step 5: Confirm service_role and admin paths are untouched** — the fixture upserts through `adminDb()` (service role) and the admin session reads through the same policy.

```bash
pnpm test:integration -t "an admin sees every provisioned tenant"
```

Expected: 1 passed, not skipped.

- [ ] **Step 6: Commit.**

```bash
git add supabase/migrations/20261010000000_credential_reference_unselectable.sql
git commit -m "fix(db): a tenant's select on api_credentials names the three status columns only"
```

---

### Task 5: The four gates, plus the read path the page actually uses

**Files:**
- None changed in this task.

**Interfaces:**
- Consumes: Task 4's applied migration.
- Produces: the evidence block the PR body needs, and confirmation that no `select *` or `id` read anywhere regressed.

- [ ] **Step 1: Grep for a read this change could have broken.**

```bash
grep -rn 'from("api_credentials")' --include="*.ts" app lib scripts tests
```

Expected: the three known sites — `lib/db/repository.ts:333` (three columns), the integration file, and `tests/fixtures/identity-users.ts:98` (a **service-role** upsert, so `insert`/`update` privileges, which `authenticated` never had and this unit does not touch). If a fourth names `*` or `credential_reference`, report it — do not widen the grant to make it pass.

- [ ] **Step 2: Run the gates in order.**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: `Test Files 38 passed` / `Tests 249 passed`, typecheck silent, lint no output, build green with `/connections` still `ƒ`.

- [ ] **Step 3: Run the whole suite including integration.**

```bash
pnpm test:all
```

Expected: unit + **21** integration tests passing (see the Task 2 Step 3 correction — the tier is
not 11). The `@auth` e2e tier is not part of this and stays blocked by Open Question 11.

- [ ] **Step 4: Read the page once with a real session.** Clear any stale process on the port the app uses, start the dev server, sign in as the demo client, load `/connections`, and confirm the cards still render "Not connected"/"Linked" as they did (`RULES.md` §5). Then **stop the server** — no orphaned dev server when this session ends. If signing in is not feasible here, say so in the PR body rather than implying the UI was checked.

- [ ] **Step 5: No commit** unless Step 1 or 2 forced a change.

---

### Task 6: Make the docs say what Postgres now does

**Files:**
- Modify: `context/feature-specs/09-connections.md:35-39`
- Modify: `AGENTS.md` (the `api_credentials` paragraph under Tenant isolation)
- Modify: `docs/target-state.md` (the worker's credential-resolution constraint)
- Modify: `context/architecture-context.md` (the storage/invariants line about the grant, if present)
- Modify: `RULES.md` §13 (added after Task 2's review: "two live-RLS files with 9 tests" is stale —
  the `integration` project also runs `tests/admin/integration/provisioning.test.ts`, so the tier is
  21 tests as of `f0448b9`; `RULES.md` §10 makes the doc the defect when code disagrees with it)
- Modify: `context/progress-tracker.md` (Current Phase, In Progress, Recent Work, Open Questions)

**Interfaces:**
- Consumes: Task 4 Step 4's printed `f | t`.
- Produces: no doc anywhere describing the column as tenant-selectable, and no doc claiming hosted has it.

- [ ] **Step 1: Rewrite the limitation.** In `09-connections.md`, replace the "Accepted limitations" bullet at lines 36-39 with a closed statement: the grant names `client_id`, `source`, `created_at`; `credential_reference` is denied at the column by `20261010000000_credential_reference_unselectable.sql`; **applied to the local stack only**, hosted pending.

- [ ] **Step 2: Correct `AGENTS.md`.** In the hand-maintained block under Tenant isolation, the sentence reading "That last migration is applied to the local stack **and** to the hosted project (2026-09-30) … Being row-level, the policy leaves `credential_reference` column-selectable to any tenant that can see the row — recorded as an accepted limitation" must change: the column is no longer selectable, and the new migration is **local-only**. Below the `# SERVICE ARCHITECTURE` heading this file is hand-maintained; do not touch the `next dev` block above it.

- [ ] **Step 3: State the forward constraint in `docs/target-state.md`.** One paragraph: the sync worker resolves a credential reference through a service-role read or a `security definer` function, never a tenant-visible `select` — because this unit made the column unreadable to `authenticated`, and a worker that reads it as the caller would undo both. Cite the migration file. Do not cite target-state as current behavior anywhere else (`RULES.md` §15).

- [ ] **Step 4: Update `context/architecture-context.md` only if it is stale.** Run `grep -n "credential_reference\|api_credentials" context/architecture-context.md`; for each hit, decide from the line whether it now misdescribes the grant. Rewrite the ones that do; leave and report the ones that don't. If no hit misdescribes it, skip this step and say "architecture-context needed no change" in the commit body rather than editing to look thorough.

- [ ] **Step 5: Update `context/progress-tracker.md`.** Current Phase: the hardening pass is complete at three units. In Progress: unit 3 built, green locally, hosted apply awaiting its own yes. Recent Work: one dated entry naming the mechanism Postgres actually required (A or B — this is the detail only the probe could settle), the before/after `has_column_privilege` prints, and the test counts. Open Questions: mark the `credential_reference` item closed with the mechanism, and add the hosted-apply as its own open line.

- [ ] **Step 6: Check nothing still claims the old state.**

```bash
grep -rn "credential_reference" --include="*.md" context docs AGENTS.md RULES.md
```

Expected: every hit either describes the narrowed grant or is the spec/plan pair this change implements. No hit left calling the column tenant-readable.

- [ ] **Step 7: Commit.**

```bash
git add context/ AGENTS.md docs/ RULES.md
git commit -m "docs: the credential reference is Postgres-denied now, and hosted has not been told"
```

Corrected as written: the plan's original `git add` listed only `context/ AGENTS.md docs/`, so it
would have left the `RULES.md` §13 fix — which this task's own file list requires — unstaged.

---

### Task 7: Close out — only on King's ask

**Files:**
- None.

- [ ] **Step 1: Report the diff file-by-file and propose the commands.** Per the standing approval gate, nothing here is pushed, opened as a PR, or applied to hosted without its own yes.

- [ ] **Step 2: Proposed branch and PR shape** (branch was cut in Task 1 pre-flight below): title `fix(api): a tenant cannot select the credential reference`, body = what changed (2-3 bullets), how it was verified (the four gates + `21 passed / 0 skipped` + the before/after privilege prints), what wasn't covered (**hosted database untouched**, `@auth` e2e still blocked by Open Question 11, the worker's real credential read still unbuilt). Corrected as written: the plan first said `11 passed / 0 skipped`, the same stale tier arithmetic as Task 2 Step 3 — the `integration` project is `tests/*/integration/**/*.test.ts` and also runs `tests/admin/integration/provisioning.test.ts` (10), so the measured tier is 21 (`credentials-visibility.test.ts` 6 + `rls-gate.test.ts` 5 + provisioning 10).

- [ ] **Step 3: Hosted apply stays a separate decision.** When asked for it, the command is `SUPABASE_DB_URL=<hosted> pnpm db:migrate` against the hosted URL already in `.env`, followed by a session-scoped read check on the hosted stack — not a re-run of the local integration tier, which points at `127.0.0.1`.

## Pre-flight (do this before Task 1, as part of starting the work)

```bash
git switch -c fix/credential-reference-column origin/main
```

`main` is at `76d142f` (PR #25 merged) and the tree is clean. The spent branches (`fix/metrics-cache-posture` and the three `feat/*`) are all merged and can be deleted later, but deleting a branch needs its own yes (`RULES.md` §7).

## Deviations from the spec, with reasons

1. **Two test cases instead of one.** Spec §133 describes a single case covering both halves. Split into a positive and a negative case so a red run says *which* half broke — a failure in the positive case means the migration cut too deep, which is the dangerous direction and should never look like "the reference is still readable".
2. **Task 3 probes before the migration is written.** The spec lists verification as a property of the unit; this plan makes it a task with its own output, because the mechanism decides the file's contents and the hypothesis above predicts the spec's expected form will not work.
3. **The negative case asserts through the app's own client**, not raw SQL as `authenticated`. `SET ROLE authenticated` in psql tests the grant but not the path a request takes (PostgREST + the policy + the column check together), and a pass there would not be evidence about `/connections`.
4. **The migration timestamp is the spec's `20261010000000`, not today's date**, so the file and spec §128 point at each other. Ordering is unaffected: it sorts after the applied `20261005000000`.

## What this unit does not touch

The sync pipeline and the worker-hosting decision, real credential writes, `is_stale`'s missing writer, `aiCitations`, the six blocked `@auth` admin specs, and the `databaseOperation()` wrapper that swallows its cause. No new dependency, no new module, no change to `lib/api/guard.ts`.
