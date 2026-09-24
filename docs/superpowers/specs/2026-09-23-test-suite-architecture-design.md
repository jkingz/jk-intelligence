# Test suite architecture: `tests/<feature>/{unit,integration,e2e}`

Date: 2026-09-23 · Status: draft for review · Branch: `dev`

Replaces the colocation mandate in `RULES.md` §13 and `context/code-standards.md:225`.
Supersedes the unused `components/features/<slug>/tests/` slot in
`docs/conventions/feature-components.md:24` and `.claude/skills/feature-component/SKILL.md:26`.

## 0. The two calls I made, since the design review stopped short of them

You approved sections 1–2 and then said write the spec, so the two open questions in sections 3 and 5
got decided rather than asked. Both are one-line reversals if you disagree.

1. **§6's merge rule.** The RLS integration slice will not be committed until it has run green once
   against a real stack; the tier *structure* commits without it. I chose this because
   `RULES.md` §2 forbids presenting a never-executed test as coverage. The alternative is committing
   the slice in a skipped state and accepting that its assertions are guesses.
2. **§8 supersedes `components/features/<slug>/tests/`.** I chose to delete that slot from the
   convention doc and the `feature-component` skill. The alternative is keeping it, which means three
   legitimate places for a test and the next feature-component run will pick one at random.

## 1. Problem

The repo has **19 test files / 122 tests** (verified `pnpm test` → `Test Files 19 passed`,
`Tests 122 passed`, `681ms`), all colocated as `*.test.ts`. They are uniformly *unit* tier: every
one mocks at a module boundary and touches no network, no database, no browser.

There is no integration tier and no e2e tier, so the two invariants the docs call highest-value —
tenant isolation enforced by Postgres RLS, and the rendered dashboard — are asserted only against
mocks. A mocked gate cannot tell you the policy file is wrong.

This reverses a recorded decision. `context/progress-tracker.md:217` removed an empty `tests/`
directory precisely because "tests are colocated `**/*.test.ts`". The reversal is justified by what
changed since: the suite now needs two tiers that colocation cannot express, because an integration
test of `lib/db/repository.ts` has no natural `app/`-side neighbour and an e2e spec of the dashboard
belongs to no module at all. Colocation was the right rule for a one-tier suite and is the wrong
shape for a three-tier one.

## 2. Non-goals

- React component-render tests. Decided against: the unit tier stays Node-environment and no
  `@testing-library/*` or `jsdom` dependency is added. UI behavior is covered by the e2e tier.
  `context/code-standards.md:245` ("Adding a testing-library dependency is a decision to raise")
  stays standing: this change does not make it.
- Coverage thresholds or a coverage provider.
- Integration/e2e for the queue worker. Nothing hosts the queue in production (`AGENTS.md`), so
  there is no behavior to pin yet.
- Putting the integration tier in CI. Requires a Postgres service container that does not exist
  today; recorded as follow-up (§10).

## 3. Taxonomy

```
tests/
  <feature>/           # identity, tenant-isolation, dashboard, export, sync, landing, platform
    unit/ | integration/ | e2e/     # only the tiers that exist for that feature
  fixtures/            # shared data builders (empty until §6/§7 need them)
  helpers/             # shared test infrastructure (same)
```

| feature | owns |
|---|---|
| `identity/` | `lib/agents/authAgent`, `lib/auth/{cron,routing}`, `lib/supabase/*`, `proxy.ts`, the `/auth/*` pages, `components/features/{user-profile,email-password-auth}/lib` |
| `tenant-isolation/` | `canAccessClient` / `listAccessibleClients` and the RLS policies in `supabase/migrations/` behind them |
| `dashboard/` | `/api/dashboard/boot`, both `/api/metrics/*` routes, `lib/dashboard/*`, `lib/cache/*` tag ownership, `/dashboard` |
| `export/` | `/api/exports/[clientId]/{csv,pdf}`, `lib/exports/*`, the export menu |
| `sync/` | `/api/cron/sync`, `/api/revalidate/dashboard`, `lib/queue/*` |
| `landing/` | `/`, `/privacy`, `/terms`, `components/features/landing/*` |
| `platform/` | cross-cutting primitives with no owning feature — today that is `lib/rate-limit.ts` alone |

The folder is `identity/` rather than `auth/` because three
`components/features/user-profile/lib/*.test.ts` files concern the signed-in account, not a
credential exchange — a folder named `auth/` would split one invariant in two.

`platform/` exists because `lib/rate-limit.ts` has 8 consumers across 3 features
(`export-menu`, `edit-profile-form`, `account-menu`, `google-sign-in`, `apple-sign-in`,
`sign-out-button`, `demo-access`, `email-auth-form`) plus `lib/exports/quota.ts`. It belongs to no
feature, and filing it under one would be a lie.

**Placement rule.** A test file goes in the feature that owns the *invariant the test protects*,
not the directory the subject module happens to live in. `lib/auth/cron.ts` is the worked example:
its only consumers are `/api/cron/sync` and `/api/revalidate/dashboard`, so a consumer reading says
`sync/`, but the invariant that fails is authentication, so it belongs in `identity/` — alongside the
`routing.test.ts` and `authAgent.test.ts` files that guard the same boundary. `platform/` is the only
escape hatch, for subjects no single feature owns.

**Naming.** `<sut>.test.ts` under `unit/` and `integration/`; `<flow>.spec.ts` under `e2e/`. Where a
bare `route.test.ts` would collide with a future sibling, prefix with the SUT (`boot-route.test.ts`).

### 3.1 Migration map (all 19 files)

| # | from | to |
|---|---|---|
| 1 | `app/api/dashboard/boot/route.test.ts` | `tests/dashboard/unit/boot-route.test.ts` |
| 2 | `app/api/metrics/[clientId]/overview/route.test.ts` | `tests/dashboard/unit/overview-route.test.ts` |
| 3 | `app/api/metrics/[clientId]/keywords/route.test.ts` | `tests/dashboard/unit/keywords-route.test.ts` |
| 4 | `lib/dashboard/overview.test.ts` | `tests/dashboard/unit/overview.test.ts` |
| 5 | `lib/dashboard/keywords.test.ts` | `tests/dashboard/unit/keywords.test.ts` |
| 6 | `app/api/exports/[clientId]/route.test.ts` | `tests/export/unit/export-route.test.ts` |
| 7 | `lib/exports/exports.test.ts` | `tests/export/unit/exports.test.ts` |
| 8 | `lib/exports/quota.test.ts` | `tests/export/unit/quota.test.ts` |
| 9 | `lib/queue/syncQueue.test.ts` | `tests/sync/unit/syncQueue.test.ts` |
| 10 | `lib/queue/flow.test.ts` | `tests/sync/unit/flow.test.ts` |
| 11 | `app/api/revalidate/dashboard/route.test.ts` | `tests/sync/unit/revalidate-route.test.ts` |
| 12 | `lib/db/repository.test.ts` | `tests/tenant-isolation/unit/repository.test.ts` |
| 13 | `lib/agents/authAgent.test.ts` | `tests/identity/unit/authAgent.test.ts` |
| 14 | `lib/auth/cron.test.ts` | `tests/identity/unit/cron.test.ts` |
| 15 | `lib/auth/routing.test.ts` | `tests/identity/unit/routing.test.ts` |
| 16 | `components/features/user-profile/lib/profile.test.ts` | `tests/identity/unit/profile.test.ts` |
| 17 | `components/features/user-profile/lib/update-profile-action.test.ts` | `tests/identity/unit/update-profile-action.test.ts` |
| 18 | `components/features/user-profile/lib/sign-out-action.test.ts` | `tests/identity/unit/sign-out-action.test.ts` |
| 19 | `lib/rate-limit.test.ts` | `tests/platform/unit/rate-limit.test.ts` |

Post-move per-tier counts: `identity/6 · tenant-isolation/1 · dashboard/5 · export/3 · sync/3 ·
platform/1 = 19`.

**What the move actually edited.** The `git mv` was the cheap half. **19 of 19** files needed a
specifier rewrite, not 17: 15 static `from "./x"` lines across 11 files, **plus three dynamic
`await import("./x")` specifiers** that a `from "` grep cannot see —
`tests/sync/unit/flow.test.ts:69` (`./worker`), `tests/export/unit/quota.test.ts:19` (`./quota`), and
`tests/identity/unit/update-profile-action.test.ts:25` (`./update-profile-action`). Those three are
also why the two files this section originally called "move untouched" were not untouched: their
*static* imports already went through `@/`, but each re-imports its subject dynamically to get a fresh
module instance after `vi.resetModules()`. Left alone they fail at collection, and the failure is quiet
in the worst way — the file reports 0 tests, so the suite count drops (118, not 122) while every other
file is green.

The good news held: **no `vi.mock()` call in the repo uses a relative specifier** — they all
already name `@/lib/db/repository`, `@/components/features/user-profile/lib/profile` and so on, so
the boundary mocks that make these tests work survived the move unchanged.

Two specifics to get right. `app/api/exports/[clientId]/route.test.ts` imports `./csv/route` and
`./pdf/route`, so its new specifiers embed a bracketed dynamic segment
(`@/app/api/exports/[clientId]/csv/route`) — brackets are legal in a path but read as glob syntax to
some resolvers, so `pnpm typecheck` was the arbiter. **Resolved during implementation: they resolve
cleanly** under both `tsc` and Vite's alias, all 20 tests in that file pass, and the bracket-free
`lib/test-entrypoints.ts` shim the plan held in reserve was not needed. And the 5 `app/api/**` files
sit under Next's generated-types world; moving the file out of the route folder does not touch the
route itself, so `RouteContext<"/path">` generics in the handler are unaffected — worth stating
because it is the obvious thing to worry about and it proved not to be a risk: `pnpm build` still
emits all seven `/api/*` handlers after the move.

`tsconfig.json` needs no change — `include: ["**/*.ts"]` already covers `tests/`, and `@/*` maps to
the repo root, so `tests/**` resolves app imports unchanged. `pnpm lint` still covers them (only
`.next/** out/** build/** next-env.d.ts .agents/**` are ignored).

## 4. Runner wiring

Vitest 5.0.1 declares projects as inline configurations on the root config
(`node_modules/vitest/dist/chunks/plugin.d.CN87HSxv.d.ts:3642`; `defineProject` is exported from
`vitest/config`). One root `vitest.config.ts` keeps today's `resolve.alias`, the `server-only`
empty-module shim and `conditions: ["react-server"]`, and declares two projects inheriting them:

```ts
test: {
  clearMocks: true,
  projects: [
    { extends: true, test: { name: "unit",        include: ["tests/*/unit/**/*.test.ts"] } },
    { extends: true, test: { name: "integration", include: ["tests/*/integration/**/*.test.ts"],
                             setupFiles: ["tests/helpers/load-test-env.ts"] } },
  ],
}
```

Two consequences worth naming. First, `include` is narrowed to `*.test.ts`, which is what stops
Vitest's default `**/*.spec.ts` glob from swallowing the Playwright specs in §7. Second, a project
that redefines `alias`/`resolve` gets its own Vite server instead of sharing the root one
(`plugin.d.ts:3644-3657`) — so projects must not redefine them, or the `server-only` shim silently
stops applying.

The root config's `exclude` list (`.agents/**`, `.claude/**`, `.playwright/**`) becomes dead weight
once `include` is anchored to `tests/*/…`; drop it in the same edit rather than keeping a list that no
longer describes what is being skipped.

**First-run check — resolved during implementation.** `extends: true` does propagate `resolve`: with
the alias declared only at the root, all 19 files collect and pass (122 tests), which also proves the
`server-only` shim and `conditions` carried through (files that need them would fail at import). No
project needs to redefine `resolve`, so §4's warning above stands as written.

**Correction: `passWithNoTests` is not a project option in Vitest 5.** Placing it inside
`test: { name: "integration", … }` fails `pnpm typecheck` with `TS2769 … 'passWithNoTests' does not
exist in type`. It is also unnecessary where this section implied it: `vitest run` (both projects)
exits 0 when only one project is empty — measured with an empty `integration` tier and 19 unit files.
Only `vitest run --project integration` alone exits 1 on "No test files found", so the flag is a CLI
flag on that one script (§4.1) and nowhere else. Keeping it off `pnpm test` is the point: a unit file
dropped by a bad glob must stay a hard failure, not a silent green.

### 4.1 Commands

| command | runs | gate |
|---|---|---|
| `pnpm test` | `vitest run --project unit` | the 122 existing tests, ~0.7s — unchanged meaning in `RULES.md` §13 and CI |
| `pnpm test:integration` | `vitest run --project integration --passWithNoTests` | local, opt-in (§6) |
| `pnpm test:all` | `vitest run` | **both Vitest projects, not Playwright** — the name is deliberate, so do not read it as "everything" |
| `pnpm test:e2e` | `playwright test --project public` | public pages, CI (§7) |
| `pnpm test:e2e:auth` | `playwright test --project auth` | local only |

Path narrowing survives, but not through `--`. Measured against this repo's pnpm 10.18.3:
`pnpm test dashboard` collects only the dashboard files, while `pnpm test -- dashboard` collects all
19 — the `--` is swallowed and the filter never reaches Vitest. That second form is the dangerous one:
it reports a whole-tier green run that reads like a subset. Use `pnpm test <pattern>` or
`pnpm exec vitest run --project unit <pattern>`.

**The risk this creates, stated plainly:** `pnpm test` no longer means "the whole suite". A
contributor reading §13 literally can watch 122 green tests and believe the repo is verified while
every integration file skips for want of a `TEST_SUPABASE_URL`. Mitigations, all three required:
(a) the rewritten §13 names all five commands in §4.1 and what each leaves unchecked; (b)
`tests/helpers/load-test-env.ts` logs one line when it skips, naming the variable it wanted — with a
limit found by measuring rather than trusting: it is registered as a `setupFiles` entry, so it runs
per test file and therefore **cannot fire while the tier is empty**. Verified by adding a probe file
(the warning appeared, on stderr, alongside a passing collect) and removing it (the warning never
printed, and `--passWithNoTests` turned the run green). `globalSetup` does not close this hole either;
registering the same module there suppressed collection entirely. The only honest signal available for
an empty tier is Vitest's own `No test files found, exiting with code 0`; (c)
`pnpm test:all` exists and the doc says to run it before pushing.

## 5. Unit tier

Content rules are the current ones, re-scoped: mock at the module boundary
(`@/lib/db/repository`, `@/components/features/.../lib/profile`), never inside business logic; no
real network or database call. The sentence "never a real network/DB call" applies **to this tier
only** — it is exactly what §6 exists to violate, and `RULES.md` §13 must say so or the two rules
contradict each other.

New behavior still gets its test in the same change, and a bugfix still gets a test that fails
without the fix; only the address changes.

## 6. Integration tier

**Why the seam is where it is.** `lib/supabase/server.ts` performs `const cookieStore = await
cookies()`, so `canAccessClient()` cannot be invoked from a plain Node test at all — `next/headers`
has no request scope there. The tier therefore fakes exactly one thing and leaves everything below
it real:

```
fake   next/headers.cookies()      -> a store seeded with a token from signInWithPassword()
real   @supabase/ssr  ->  PostgREST HTTP  ->  Postgres RLS  ->  private.current_user_role()
```

`lib/db/repository.ts` runs unmodified. That is the whole point: the test exercises the gate the app
uses, not a reimplementation of it. Faking `cookies()` is a boundary mock in the §5 sense — external
framework I/O, not business logic.

**Skip mechanism.** `describe.skipIf(!hasTestDb)` at the top of each integration file;
`skipIf` exists on the suite chain (`config.d.CU_b-wJj.d.ts:3138`). `hasTestDb` is
`Boolean(process.env.TEST_SUPABASE_URL)`, exported from `tests/helpers/db.ts`.

**Env loading.** `NODE_OPTIONS="--env-file=…"` is rejected by Node 24 (observed: `node: --env-file=
is not allowed in NODE_OPTIONS`), so the documented approach cannot work. Instead
`tests/helpers/load-test-env.ts`, registered as the integration project's `setupFiles`, calls
`process.loadEnvFile("<repo>/.env.test")` inside a `try/catch` for a missing file — verified working
on this Node (`process.loadEnvFile: ok`). `.env.test` is already untracked by the existing
`.env*` gitignore pattern, so no `.gitignore` change is needed for it and no secret can be
committed by accident. The live project's `.env` is never read by this tier; pointing tests at it is
the failure mode the separate variable exists to prevent.

**`loadEnvFile` does not override what is already set** (measured: with `QODER_COLLIDE=from-shell` in
the environment and `from-file` in the file, the process kept `from-shell`). That settles two things.
Every variable this tier reads gets a `TEST_` prefix — reusing `SUPABASE_SERVICE_ROLE_KEY` would be a
silent no-op for anyone whose shell already exported the live one, which is precisely the developer
with `.env` sourced. And when a value looks ignored, the shell is the suspect, not the file.

**Required variables** (names only; values are secrets and stay out of every committed file, per
`RULES.md` §6): `TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`,
`TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_DEMO_PASSWORD`.

**Fixtures.** `tests/fixtures/identity-users.ts` provisions, idempotently and via service-role
`auth.admin.createUser` — the mechanism already proven in `scripts/create-demo-user.mjs:57` — three
auth users on two clients: `client@a` (role `client`, client A), `client@b` (role `client`,
client B), `staff@a` (role `staff`, client A). Rows come from `scripts/seed.mjs` run against the
test URL, not a second hand-written dataset.

**First slice: `tests/tenant-isolation/integration/rls-gate.test.ts`.** Four assertions, each
against the real `lib/db/repository.ts`:
1. as `client@a`, `listAccessibleClients()` returns A and not B;
2. as `client@a`, `canAccessClient(B)` is `false` and `canAccessClient(A)` is `true`;
3. as `staff@a`, A is visible and B is not;
4. an unauthenticated token sees neither.

**Prerequisite, and it is not met today.** This needs a reachable Postgres running the Supabase
platform roles — `supabase/migrations/20260917000000_seo_poc.sql` references `auth.users`,
`auth.uid()` and grants to `authenticated` / `service_role` / `anon`, so a bare Postgres container
cannot apply it without shimming `auth`. On this machine Docker is installed but **not running** and
the `supabase` CLI is **not installed**.

**Merge rule.** The RLS slice does not merge until it has been run green once against
`supabase start`. Shipping it skipped-and-never-executed would be exactly the claim `RULES.md` §2
forbids. The structure in this section (project, `skipIf`, `load-test-env`, the helper that fakes
`cookies()`) does merge, because it is verified by the 19 unit files still passing and by an
integration file reporting `skipped` for the right reason. If the stack cannot be brought up during
implementation, §6 stops after the structure and the slice becomes the next change.

## 7. e2e tier

`@playwright/test` as a devDependency, Chromium only. `playwright.config.ts` at the root with
`testDir: "./tests"`, `testMatch: "**/e2e/**/*.spec.ts"`, and two projects — `public`
(`grepInvert: /@auth/`) and `auth` (`grep: /@auth/`). Tags rather than an env branch so the same
binary serves both commands and CI cannot accidentally run the authed set.

`webServer`: `pnpm start` on CI, reusing the `.next` build the pipeline already produces;
`pnpm dev` with `reuseExistingServer: true` locally. Base URL comes from `NEXT_PUBLIC_APP_URL`, which
in this checkout is `http://localhost:3000` — and because that variable is `NEXT_PUBLIC_*` it is
already in the client bundle, so reading it is not a secret leak under `RULES.md` §6.

Specs in the first change:

| file | tier | asserts |
|---|---|---|
| `tests/landing/e2e/marketing.spec.ts` | public | landing renders; `/privacy` and `/terms` each reachable from the footer (the two clicks are separate navigations — the legal pages use `LegalPageShell`, which does not repeat the landing footer) |
| `tests/identity/e2e/login.spec.ts` | public | `/auth/login` serves the form with both fields; submitting it empty is blocked client-side and does not navigate |
| `tests/dashboard/e2e/guard.spec.ts` | public | `/dashboard` and `/profile` unauthenticated land on `/auth/login` with the measured `?next=` value |
| `tests/dashboard/e2e/overview.spec.ts` | `@auth` | demo login reaches the dashboard and a metric renders |
| `tests/export/e2e/csv.spec.ts` | `@auth` | CSV download produces a non-empty file with the expected header row |

**Correction to the original `login.spec.ts` row, which said "submitting bad credentials surfaces an
error".** That assertion cannot run in CI: the submit goes to `NEXT_PUBLIC_SUPABASE_URL`, which under
`ci.yml` is `https://ci-placeholder.supabase.co` — the request dies on DNS, so no auth error message
ever renders, and the test would be asserting a network failure while looking like a product one. The
bad-credential round-trip belongs to the `@auth` tier, which only runs against a real project; what the
public tier can prove is the form's structure and its client-side `required` validation, which needs no
server at all.

Two things learned by running it rather than reasoning about it. The page has **two** buttons matching
`Sign in` — the submit and a separate "Sign in as demo" — so the public spec must scope the click to
the form and pass `exact: true`, or Playwright's strict mode fails the run on an ambiguity that is
invisible in the markup. And the plan's predicted five public specs are six, because the footer check
is two navigations rather than one chain.

**A third, and it invalidates the plan's env story.** The `@auth` helper reads
`DEMO_EMAIL` / `DEMO_PASSWORD` from `process.env` (renamed from the `NEXT_PUBLIC_DEMO_*` pair on
2026-09-24 — Q4 moved the creds out of the client bundle; `tests/helpers/log-in.ts` reads them in
Node, so the prefix never mattered there), and the plan asserted they
"arrive because Next loads `.env` for `next dev` and `webServer` inherits the shell". That is wrong in
the direction that matters: `next dev` loads `.env` **into its own child process**, and the Playwright
runner is a *different* process whose `process.env` the child cannot write back to. Both specs failed
on the missing-variable guard until `tests/helpers/load-e2e-env.ts` was added and imported from
`playwright.config.ts`. Two constraints fell out of that fix worth keeping:

- It loads `.env.local` **before** `.env`, because `process.loadEnvFile` never overrides a variable
  that is already set, so first-loaded wins — the inverse of Next's own precedence, arrived at by
  reversing the file order.
- It resolves paths from `process.cwd()`, **not** `import.meta.url`. Playwright transpiles the config
  to CommonJS (this package has no `"type": "module"`), and a helper imported from it hits
  `SyntaxError: Cannot use 'import.meta' outside a module`. The Vitest integration helper in §6 uses
  `import.meta.url` and is fine, because Vite loads it as ESM — the two helpers look interchangeable
  and are not.

Also confirmed by running, not reasoning: `<section aria-label="Performance metrics">` **is** exposed as
`role="region"` once it has an accessible name, so `getByRole("region", …)` matches directly and the
plan's `.or(locator)` hedge was unnecessary and is not in the committed spec. The downloaded CSV's first
row is `\uFEFF` + `date,source,keyword,clicks,impressions,ctr,position,conversions,rank,search_volume`,
with CRLF line endings — a BOM `buildCsv` adds deliberately for Excel (`lib/exports/csv.ts:68`), so the
spec asserts its presence instead of stripping it.

**Resolved: the public tier does work under placeholders.** Measured on 2026-09-23 by building and
serving with only the two values `ci.yml` sets:

| probe | result |
|---|---|
| `pnpm build` with placeholders | exit 0; `/`, `/dashboard`, `/privacy`, `/terms` prerendered as static `○`, `ƒ Proxy (Middleware)` emitted |
| `GET /` | **200**, no redirect, body 40,483 bytes containing "JK Intelligence" and "Unified organic metrics" |
| `GET /auth/login` | **200**, body 24,350 bytes |
| `GET /privacy`, `/terms` | 200 / 200 |
| `GET /dashboard` | **307 → `/auth/login?next=%2Fdashboard`** |
| `GET /profile` | **307 → `/auth/login?next=%2Fprofile`** |
| `GET /api/dashboard/boot` | **401** — the no-session path, and it never reaches a read |

So all three public specs are CI-safe as written, and `guard.spec.ts` can assert the real 307 target
rather than a guessed one. `app/page.tsx:10` renders `<LandingPage />` and nothing in
`components/features/landing/*.tsx` reads a profile — `progress-tracker.md:52`'s "`/` now dynamically
reads authenticated email" is a frozen historical entry that the current code contradicts. It is not
edited (entries under "What happened" are dated logs, per that file's own note at `:15-16`); this
table supersedes it.

**How to reproduce, and why `.env` stays put.** `context/development-workflow.md` does not cover this,
so: Next's load order is `process.env` → `.env.$(NODE_ENV).local` → `.env.local` → `.env.$(NODE_ENV)` →
`.env`, **stopping once the variable is found**
(`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:266-276`). Exporting the two
placeholders in the shell therefore overrides the live `.env` values without moving or editing that
file — and since `NEXT_PUBLIC_*` is inlined at build time from the build environment
(`:158-164`), the resulting `.next` genuinely is the CI artifact, not a runtime imitation.

Side effect to be aware of: `.next` in this checkout is now built with placeholder values. Any
`pnpm start` before the next `pnpm build` serves the placeholder bundle.

Authed specs reuse the existing demo account (`DEMO_EMAIL` /
`DEMO_PASSWORD`, provisioned by `pnpm db:demo-user`). They log in through the real form,
not by injecting a cookie, because the login flow is itself the thing without coverage.

`.gitignore` gains `/playwright-report/` and `/test-results/`. `.playwright-cli/` is already ignored
and stays as the ad-hoc exploration tool.

**CI:** one step after Build in the existing job — `pnpm exec playwright install --with-deps
chromium` then `pnpm test:e2e`. The `checks` job already builds, so `pnpm start` has an artifact.
Cost is roughly the browser download plus one Chromium run; `pnpm test && typecheck && lint && build`
keeps its current meaning and the four-command gate is unchanged.

## 8. Documentation rewrite (same change)

| file | change |
|---|---|
| `RULES.md:73-74` | replace the colocation mandate with the §3 tree and the §4.1 command table; scope "never a real network/DB call" to the unit tier; keep §13's four-command gate, add the `pnpm test:all`-before-pushing note |
| `AGENTS.md:124` | "Tests colocate as `*.test.ts`" → the new sentence; `Verification` block lists the §4.1 commands |
| `context/code-standards.md:225` | "there is no root `tests/` directory" is falsified — rewrite |
| `context/code-standards.md:227-246` | tier semantics, the four commands, `:243`'s file paths, `:245` "no browser tests exist yet" → now false |
| `context/development-workflow.md` | "Tests" row in the commands table; verification item 1 |
| `docs/conventions/feature-components.md:23-24` | drop the per-feature `tests/` slot from the tree diagram, point to `tests/<feature>/` |
| `.claude/skills/feature-component/SKILL.md:25-26` | same two lines |
| `context/progress-tracker.md` | entry recording the reversal of `:217`, its reason, and the new commands |

**The skill-copy hazard, measured — and it is not one mechanism but three.** This section asserted
that `.claude/skills/` and `.agents/skills/` are "hardlinked copies". Sampling five entries with
`ls -i`, `readlink` and `realpath` shows three different situations, and only one of them is a
hardlink:

| `.agents/skills/<name>` | reality | consequence |
|---|---|---|
| `feature-component` | **symlink** → `../../.claude/skills/feature-component` | one file, two paths. Editing either updates both; drift is impossible. `git check-ignore` on the inner path dies with `pathspec … is beyond a symbolic link`, and git tracks the symlink as a single blob — so `git add .agents/skills/feature-component/SKILL.md` fails and must not be in any command list. |
| `code-review`, `frontend-design` | real directories, **same inode** as the `.claude` twin | genuine hardlinks. In-place writes (`open(f,'w')`, `ln -f`) propagate; an editor that writes-then-renames breaks the link and leaves one copy stale in silence. Verify with `ls -i` after editing. |
| `babysitting-a-pr`, `leaving-pr-comment` | real directories, **different inodes** | independent copies. Byte-identical today, and free to diverge tomorrow. |

The practical rule is the one `AGENTS.md` already gives — edit `.claude/` as the source of truth — but
its stated reason ("hardlinked copies") is wrong for three of the five sampled, and wrong in the
direction that hides work: a reader who believes everything is linked will edit one path and never
look at the other, which is precisely how the third group breaks. The inode of
`feature-component/SKILL.md` cited in the original version of this paragraph was real and identical on
both paths, and was read as proof of a hardlink when a symlink produces exactly the same `ls -i`
output. Confirm with `readlink` before concluding anything from an inode.

## 9. Acceptance

The change is done when each line prints what it claims:

1. `pnpm test` → `Test Files 19 passed (19)`, `Tests 122 passed (122)` — same counts as before the
   move, from `tests/*/unit/`.
2. `pnpm test:integration` with no `.env.test` → the suite reports skipped and the helper names
   `TEST_SUPABASE_URL`; exit status green.
3. `pnpm test:integration` with the local stack up → the RLS slice passes 4/4. Skipped, not
   claimed, if §6's prerequisite is unmet.
4. `pnpm typecheck` → clean (proves every moved import resolves).
5. `pnpm lint` → clean.
6. `pnpm build` → clean, and all seven `/api/*` route handlers still emit
   (`cron/sync`, `dashboard/boot`, `exports/[clientId]/{csv,pdf}`, `metrics/[clientId]/{keywords,overview}`,
   `revalidate/dashboard`).
7. `pnpm test:e2e` → public specs pass against `pnpm start` with placeholder env, and `guard.spec.ts`
   asserts the measured 307 target `/auth/login?next=%2Fdashboard` (§7's table), not a guessed one.
8. `pnpm test:e2e:auth` → exercised locally against a seeded demo user; the observation is
   reported, not just the exit code.
9. `git ls-files 'app/**/*.test.ts' 'lib/**/*.test.ts' 'components/**/*.test.ts'` → empty.
10. `grep -rn '["'"'"']\./' tests --include='*.test.ts'` → empty. The pattern must cover **any**
    quoted specifier starting with `./`, not just `from "./` — the narrower grep passes while three
    dynamic `await import("./x")` specifiers sit undetected (§3.1), which is the exact hole this
    check exists to close.
11. `.agents/skills/feature-component` still resolves to the `.claude` file (it is a symlink, so
    `realpath` on both paths must be identical — an inode match alone would not prove the mechanism).

## 10. Open questions

1. **Integration in CI** needs either a Supabase-capable service container or the local CLI on the
   runner. Neither exists here. Deferred; revisit when a second integration file makes the skip
   pattern more costly than the job.
2. **Does `pnpm test:all` become the push gate** once integration is CI-capable? §4.1's silent-skip
   risk is the argument for it; §13's four-command gate is the thing it would change.
3. **`identity/` scope creep.** Account profile sits under an `identity` folder that also holds
   authentication. Fine at six files; if it grows past ~12 it splits into `identity/` + `profile/`.
4. **`/profile` needs no database to verify its guard.** Measured: under placeholders it answers
   `307 → /auth/login?next=%2Fprofile`. Only the signed-in half of `/profile` requires a real session;
   the unauthenticated half can be a public e2e spec, so add it to `guard.spec.ts` rather than
   hand-verifying it. (An earlier revision of this section attributed a "live auth probe" claim to
   `AGENTS.md:121`. That citation was wrong — line 121 is a closing code fence and no such phrase
   exists in the repo. The measurement above stands on its own.)
5. **Worker hosting** still undecided (`context/progress-tracker.md`); until something consumes the
   queue in production the `sync/` integration tier has no worker contract to test.
