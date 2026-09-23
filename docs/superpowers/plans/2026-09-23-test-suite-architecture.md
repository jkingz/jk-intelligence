# Three-tier `tests/` tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 19 test files into `tests/<feature>/{unit,integration,e2e}/`, wire Vitest projects and Playwright so unit/integration/e2e are separately runnable, and rewrite the docs that mandate colocation.

**Architecture:** One root `vitest.config.ts` declares `unit` and `integration` projects over a feature-first `tests/` tree; Playwright owns `**/e2e/**/*.spec.ts` with `public` and `auth` projects split by an `@auth` tag. The integration tier is structure-only in this plan — its first real slice is blocked on a local Supabase stack (spec §6).

**Tech Stack:** Vitest 5.0.1, `@playwright/test` (new), Next 16.3.5 App Router, pnpm 10.18.3, Node ≥ 24.

**Spec:** `docs/superpowers/specs/2026-09-23-test-suite-architecture-design.md` (committed `0873f13`). Read it alongside this plan; the spec carries the evidence, this plan carries the edits.

## Global Constraints

- **`pnpm test` must print `Test Files 19 passed (19)` / `Tests 122 passed (122)` at the end of every task from Task 1 through Task 3.** The count is the migration's only safety net: a file dropped by an over-narrow glob fails silently while still showing green.
- pnpm only. Node ≥ 24. Never generate `package-lock.json` (`RULES.md` §11).
- One new dependency: `@playwright/test`. No `@testing-library/*`, no `jsdom`, no coverage provider (spec §2).
- Every integration variable is `TEST_`-prefixed. `process.loadEnvFile` does not override variables already in the shell, so a reused name is a silent no-op (spec §6).
- Never edit, move, or print `.env`. Its values are secrets; reference names only (`RULES.md` §6).
- Commit at the end of each task. **Do not push** — `RULES.md` §7 requires `git pull` from `origin/main` before any push to `dev`, and pushing is not authorized by this plan.
- Leave no orphaned server or worker on port 3000 when a task ends (`RULES.md` §5).
- Docs that a task falsifies get rewritten in that same task (`RULES.md` §14).
- This checkout's `.next` is currently built with CI placeholder env values. Any `pnpm build` or `pnpm dev` run locally rebuilds it with your real `.env`; that is expected, not a regression.

## Known deviations from the spec

Found while writing this plan, and while executing Task 1. The task noted edits the spec file itself
so the two documents do not diverge.

1. ~~Spec §4's snippet omits `passWithNoTests` on the integration project.~~ **This one was wrong.**
   Vitest 5 rejects `passWithNoTests` at project level (`tsc` TS2769), and `vitest run` does not fail
   when one of two projects is empty — only `--project integration` alone does. Fixed in Task 1 as a
   CLI flag on that one script, which also keeps `pnpm test` strict.
2. **Spec §4.1's path-filter example is wrong.** `pnpm test -- dashboard` silently runs all 19 files;
   `pnpm test dashboard` is the form that filters. Measured and corrected in Task 1.
3. **Spec §7's `login.spec.ts` asserts that bad credentials surface an error.** That cannot run in CI:
   the submit goes to `NEXT_PUBLIC_SUPABASE_URL`, which in CI is `https://ci-placeholder.supabase.co` —
   a DNS failure, not an auth error. The public spec is reduced to structure and client-side
   `required` validation; the credential round-trip moves to an `@auth` spec. Corrected in Task 5.

---

### Task 1: Vitest projects, the five commands, and the first moved file

Proves the one risky assumption in spec §4 — that `extends: true` propagates `resolve.alias` from the root config — using the smallest possible move (one file). If the assumption is false, everything after this task is unaffected and the fallback below applies.

**Files:**
- Modify: `vitest.config.ts` (whole file)
- Modify: `package.json:11` (`test` script) and add two scripts after it
- Move: `lib/rate-limit.test.ts` → `tests/platform/unit/rate-limit.test.ts`
- Modify: spec `docs/superpowers/specs/2026-09-23-test-suite-architecture-design.md:130-139` (add `passWithNoTests`)

**Interfaces:**
- Consumes: nothing.
- Produces: Vitest projects named exactly `unit` and `integration`; scripts `test`, `test:integration`, `test:all`; the directory `tests/<feature>/<tier>/` that every later task writes into.

- [ ] **Step 1: Create the destination and move the file**

```bash
mkdir -p tests/platform/unit
git mv lib/rate-limit.test.ts tests/platform/unit/rate-limit.test.ts
```

- [ ] **Step 2: Rewrite the one relative import**

In `tests/platform/unit/rate-limit.test.ts:2`, the file is no longer beside its subject:

```ts
// before
import { SlidingWindowLimiter } from "./rate-limit";
// after
import { SlidingWindowLimiter } from "@/lib/rate-limit";
```

- [x] **Step 3: Replace `vitest.config.ts`** — **done; two corrections to the snippet below.**
  `environment: "node"` stays at the root (the snippet dropped it), and there is **no**
  `passWithNoTests` key in the integration project: Vitest 5 rejects it at project level. See Known
  deviations 1.

Extract the `resolve` block into a `const` above `defineConfig` and reference it at the root only.
The fallback below (duplicating `resolve` into each project) is the **wrong** fix if it is unnecessary
— spec §4 warns a project that redefines `resolve` gets its own Vite server. Task 1 exists to settle
that, and it settled: `extends: true` alone propagated everything, 19/122 green with the alias and the
`server-only` shim declared only at the root.

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const resolve = {
  alias: {
    "@": fileURLToPath(new URL(".", import.meta.url)),
    // Bare "server-only" resolves via `main` (the throwing guard) instead of
    // the react-server export condition under vitest — point it at the no-op.
    "server-only": fileURLToPath(
      new URL("./node_modules/server-only/empty.js", import.meta.url),
    ),
  },
  conditions: ["react-server"],
};

export default defineConfig({
  resolve,
  test: {
    environment: "node",
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "tests/*/unit/**/*.test.ts",
            // Transitional: the 18 files still colocated stay in scope until
            // Task 3 removes these three globs. Deleting them early drops
            // tests silently while still reporting green.
            "app/**/*.test.ts",
            "lib/**/*.test.ts",
            "components/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/*/integration/**/*.test.ts"],
        },
      },
    ],
  },
});
```

The old top-level `exclude` array is gone: `include` now governs, and its patterns (`.agents/**`,
`.claude/**`, `.playwright/**`) no longer describe anything being skipped.

- [x] **Step 4: Add the scripts** — done as below; note the third flag on `test:integration`.

```json
    "test": "vitest run --project unit",
    "test:integration": "vitest run --project integration --passWithNoTests",
    "test:all": "vitest run",
```

- [x] **Step 5: Run the unit project and check the count, not just the color** — `pnpm test` →
  `Test Files 19 passed (19)` / `Tests 122 passed (122)`.

- [x] **Step 6: Confirm the moved file ran from its new home, and both projects resolve** —
  `pnpm exec vitest run --project unit platform` → `1 passed (1)` / `4 passed (4)`.
  `pnpm test:all` → both projects collect, integration reports no files and exits 0.

- [x] **Step 7: Fallback if Step 5 showed 18 files** — **not taken.** `extends: true` carried
  `resolve` through, so the per-project duplicate must not be added.

- [x] **Step 8: Typecheck and lint** — both clean after the `passWithNoTests` key was removed from the
  project block (it was a TS2769 error there). `tsconfig.json` needed no change.

- [x] **Step 9: Amend the spec, then commit** — spec §4 gained the resolved first-run answer, the
  `passWithNoTests` correction, and the corrected path-filter form (§4.1).

```bash
git add vitest.config.ts package.json tests/platform lib/rate-limit.test.ts \
  docs/superpowers/specs/2026-09-23-test-suite-architecture-design.md
git commit -m "test: split vitest into unit and integration projects

Moves tests/platform/unit as the first file under the feature tree and proves
alias inheritance from the root config. 19 files / 122 tests, unchanged."
```

---

### Task 2: Move the five `app/api/**` route tests

The hard half of the migration: these imports cross a bracketed dynamic segment (`[clientId]`) and are the files most likely to break resolution.

**Files:**
- Move: `app/api/dashboard/boot/route.test.ts` → `tests/dashboard/unit/boot-route.test.ts`
- Move: `app/api/metrics/[clientId]/overview/route.test.ts` → `tests/dashboard/unit/overview-route.test.ts`
- Move: `app/api/metrics/[clientId]/keywords/route.test.ts` → `tests/dashboard/unit/keywords-route.test.ts`
- Move: `app/api/exports/[clientId]/route.test.ts` → `tests/export/unit/export-route.test.ts`
- Move: `app/api/revalidate/dashboard/route.test.ts` → `tests/sync/unit/revalidate-route.test.ts`

**Interfaces:**
- Consumes: Task 1's `unit` project and transitional globs.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Move all five**

```bash
mkdir -p tests/dashboard/unit tests/export/unit tests/sync/unit
git mv "app/api/dashboard/boot/route.test.ts"          tests/dashboard/unit/boot-route.test.ts
git mv "app/api/metrics/[clientId]/overview/route.test.ts" tests/dashboard/unit/overview-route.test.ts
git mv "app/api/metrics/[clientId]/keywords/route.test.ts" tests/dashboard/unit/keywords-route.test.ts
git mv "app/api/exports/[clientId]/route.test.ts"      tests/export/unit/export-route.test.ts
git mv "app/api/revalidate/dashboard/route.test.ts"    tests/sync/unit/revalidate-route.test.ts
```

- [ ] **Step 2: Rewrite exactly these import lines**

Each is a single specifier change; nothing else in the file moves.

| file:line | before | after |
|---|---|---|
| `tests/dashboard/unit/boot-route.test.ts:31` | `"./route"` | `"@/app/api/dashboard/boot/route"` |
| `tests/dashboard/unit/overview-route.test.ts:23` | `"./route"` | `"@/app/api/metrics/[clientId]/overview/route"` |
| `tests/dashboard/unit/keywords-route.test.ts:22` | `"./route"` | `"@/app/api/metrics/[clientId]/keywords/route"` |
| `tests/export/unit/export-route.test.ts:23` | `"./csv/route"` | `"@/app/api/exports/[clientId]/csv/route"` |
| `tests/export/unit/export-route.test.ts:24` | `"./pdf/route"` | `"@/app/api/exports/[clientId]/pdf/route"` |
| `tests/sync/unit/revalidate-route.test.ts:11` | `"./route"` | `"@/app/api/revalidate/dashboard/route"` |

- [ ] **Step 3: Run the moved set**

Run: `pnpm exec vitest run --project unit dashboard export sync`
Expected: the five moved files green. **The subset total is not 53** — `revalidate-route` holds 3 tests,
not 8, so these five are 48. The number that actually matters is the 122 below.

- [ ] **Step 4: If a bracketed path fails to resolve**

Spec §3.1 flagged `[clientId]` in a module specifier as the one uncertain case. If `pnpm typecheck` errors on those three files, keep the bracketed directories as they are and instead re-export the handlers from a bracket-free shim so the tests have a stable address:

```ts
// lib/test-entrypoints.ts — only if Step 3 fails on bracket resolution
export { GET as metricsOverview } from "@/app/api/metrics/[clientId]/overview/route";
```

Record which path you took in the commit body, and amend spec §3.1's "typecheck is the arbiter there" with the actual outcome.

- [ ] **Step 5: Full gate**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: `19 passed (19)` / `122 passed (122)`, then clean.

- [ ] **Step 6: Commit**

```bash
git add tests app/api
git commit -m "test: move the five api route suites under tests/<feature>/unit"
```

---

### Task 3: Move the remaining thirteen and close the migration

After this task the transitional globs come out, and "`pnpm test`" means only what it will mean permanently.

**Files:**
- Move: 11 `lib/**` tests and 2 `components/**` tests into `tests/{identity,tenant-isolation,dashboard,export,sync}/unit/`
- Modify: `vitest.config.ts` — delete the three transitional `include` globs

**Interfaces:**
- Consumes: Task 1's projects.
- Produces: the final tree shape; spec §9's acceptance item 9 (`git ls-files` empty) becomes checkable here.

- [ ] **Step 1: Move all thirteen**

```bash
mkdir -p tests/identity/unit tests/tenant-isolation/unit
git mv lib/agents/authAgent.test.ts        tests/identity/unit/authAgent.test.ts
git mv lib/auth/cron.test.ts               tests/identity/unit/cron.test.ts
git mv lib/auth/routing.test.ts            tests/identity/unit/routing.test.ts
git mv components/features/user-profile/lib/profile.test.ts               tests/identity/unit/profile.test.ts
git mv components/features/user-profile/lib/update-profile-action.test.ts tests/identity/unit/update-profile-action.test.ts
git mv components/features/user-profile/lib/sign-out-action.test.ts       tests/identity/unit/sign-out-action.test.ts
git mv lib/db/repository.test.ts           tests/tenant-isolation/unit/repository.test.ts
git mv lib/dashboard/overview.test.ts      tests/dashboard/unit/overview.test.ts
git mv lib/dashboard/keywords.test.ts      tests/dashboard/unit/keywords.test.ts
git mv lib/exports/exports.test.ts         tests/export/unit/exports.test.ts
git mv lib/exports/quota.test.ts           tests/export/unit/quota.test.ts
git mv lib/queue/syncQueue.test.ts         tests/sync/unit/syncQueue.test.ts
git mv lib/queue/flow.test.ts              tests/sync/unit/flow.test.ts
```

`quota.test.ts` and `update-profile-action.test.ts` need no import edit — verified earlier, they are the only two of the 19 that already import through `@/`.

- [ ] **Step 2: Rewrite these eight files' imports**

| file:line(s) | before | after |
|---|---|---|
| `tests/identity/unit/authAgent.test.ts:23` | `"./authAgent"` | `"@/lib/agents/authAgent"` |
| `tests/identity/unit/cron.test.ts:3` | `"./cron"` | `"@/lib/auth/cron"` |
| `tests/identity/unit/routing.test.ts:2` | `"./routing"` | `"@/lib/auth/routing"` |
| `tests/identity/unit/profile.test.ts:23` | `"./profile"` | `"@/components/features/user-profile/lib/profile"` |
| `tests/identity/unit/sign-out-action.test.ts:2` | `"./sign-out-action"` | `"@/components/features/user-profile/lib/sign-out-action"` |
| `tests/tenant-isolation/unit/repository.test.ts:19` | `"./repository"` | `"@/lib/db/repository"` |
| `tests/dashboard/unit/overview.test.ts:4` | `"./overview"` | `"@/lib/dashboard/overview"` |
| `tests/dashboard/unit/keywords.test.ts:3,4` | `"./keywords"` (both lines) | `"@/lib/dashboard/keywords"` |
| `tests/export/unit/exports.test.ts:9` | `"./dataset"` | `"@/lib/exports/dataset"` |
| `tests/export/unit/exports.test.ts:10` | `"./csv"` | `"@/lib/exports/csv"` |
| `tests/export/unit/exports.test.ts:11` | `"./filename"` | `"@/lib/exports/filename"` |
| `tests/export/unit/exports.test.ts:12` | `"./pdf"` | `"@/lib/exports/pdf"` |
| `tests/sync/unit/syncQueue.test.ts:10` | `"./syncQueue"` | `"@/lib/queue/syncQueue"` |
| `tests/sync/unit/flow.test.ts:66` | `"./syncQueue"` | `"@/lib/queue/syncQueue"` |

- [x] **Step 3: Prove no relative specifier survived — the command below was insufficient.**

Run: `grep -rn '["'"'"']\./' tests --include='*.test.ts'`
Expected: **no output.**

`grep -rn 'from "\./'` as originally written here returned empty while three files were still broken,
because it cannot see `await import("./worker")`. The plan's own safety net had the same blind spot as
the failure it was meant to catch, and only the 122-test count exposed it. Use the broader pattern.

**Step 2's table missed those three, and they are the reason "17 of 19" was wrong.** Add to it:

| file:line | before | after |
|---|---|---|
| `tests/sync/unit/flow.test.ts:69` | `await import("./worker")` | `await import("@/lib/queue/worker")` |
| `tests/export/unit/quota.test.ts:19` | `import("./quota")` | `import("@/lib/exports/quota")` |
| `tests/identity/unit/update-profile-action.test.ts:25` | `await import("./update-profile-action")` | `await import("@/components/features/user-profile/lib/update-profile-action")` |

The last two are the files Step 1 called import-free. They re-import their subject dynamically to get
a fresh module after `vi.resetModules()`, so they collect 0 tests and the run reports 118, not 122.

- [ ] **Step 4: Remove the transitional globs**

In `vitest.config.ts`, the `unit` project's `include` becomes exactly:

```ts
          include: ["tests/*/unit/**/*.test.ts"],
```

- [ ] **Step 5: The count is the acceptance test**

Run: `pnpm test`
Expected: `Test Files 19 passed (19)` / `Tests 122 passed (122)`. If files dropped out, Step 4 narrowed the glob past something still living outside `tests/`.

- [ ] **Step 6: Nothing outside `tests/` is tracked as a test**

Run: `git ls-files '*.test.ts' | grep -v '^tests/' || echo "clean"`
Expected: `clean`.

- [ ] **Step 7: Full four-command gate, then commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all four green; build still emits all seven `/api/*` handlers.

```bash
git add tests lib components vitest.config.ts
git commit -m "test: finish the move to tests/<feature>/unit and narrow the glob

All 19 suites now live under tests/. pnpm test means the unit project only."
```

---

### Task 4: Rewrite the four docs that colocation is stated in

The rule is already false as of Task 3. Do this before any new test is written anywhere.

**Files:**
- Modify: `RULES.md:73-74`
- Modify: `AGENTS.md:123-125` and the `## Verification` block
- Modify: `context/code-standards.md:225` and `:227-246`
- Modify: `context/development-workflow.md` — the "Tests" table row

**Interfaces:**
- Consumes: the final tree and commands from Tasks 1-3.
- Produces: the wording Tasks 8 and 9 must not contradict.

- [ ] **Step 1: `RULES.md` §13**

Replace the two bullets:

```markdown
- Tests live in `tests/<feature>/<tier>/` — `identity`, `tenant-isolation`, `dashboard`, `export`,
  `sync`, `landing`, `platform`; tiers `unit`, `integration`, `e2e`. See `AGENTS.md` for what each
  feature owns. Name it `<sut>.test.ts` (unit/integration) or `<flow>.spec.ts` (e2e).
- Unit tests mock at the boundary (`@/lib/agents/...`, `@/lib/db/repository`) — never inside business
  logic, and never a real network or DB call. That last clause is **unit-only**: the integration
  tier's whole purpose is a real Postgres behind `canAccessClient` (`docs/superpowers/specs/`).
- `pnpm test` is the unit project. It is not the whole suite: integration files skip silently
  without `TEST_SUPABASE_URL`, and e2e is a separate runner. Run `pnpm test:all` and `pnpm test:e2e`
  before pushing.
- Route handlers get a `<name>-route.test.ts` covering 401 / 403 / 400 and the no-data-leaked-before-auth path.
```

- [ ] **Step 2: `AGENTS.md`**

Line 124's "Tests colocate as `*.test.ts`" becomes the new location sentence, and the `## Verification` block gains the tier commands:

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # the gate
pnpm test:all                                            # + integration (skips without TEST_SUPABASE_URL)
pnpm test:e2e                                            # public Playwright specs
```

- [ ] **Step 3: `context/code-standards.md`**

Line 225 ("there is no root `tests/` directory") is now false — replace it with the tree reference. In the Testing section, update the `pnpm test` line to name the unit project, rewrite `:243`'s two file paths to `@/tests/sync/unit/flow.test.ts` and `tests/tenant-isolation/unit/repository.test.ts`, and replace `:245`'s "No browser/component-render tests exist yet" with: e2e exists under `tests/*/e2e/`; component-render tests remain deliberately absent (spec §2).

- [ ] **Step 4: `context/development-workflow.md`**

The "Tests" row of the commands table becomes:

```markdown
| Tests | `pnpm test` (unit project) · `pnpm test:all` · `pnpm test:e2e` |
```

- [ ] **Step 5: Verify no stale mandate survives**

Run: `grep -rn "colocate\|collocate\|no root .tests" RULES.md AGENTS.md context/*.md docs/conventions/*.md`
Expected: no hits that assert colocation. A hit in a dated `progress-tracker.md` entry is history and stays.

- [ ] **Step 6: Commit**

```bash
git add RULES.md AGENTS.md context/code-standards.md context/development-workflow.md
git commit -m "docs: replace the colocation mandate with the tests/ tree"
```

---

### Task 5: Playwright, the public tier, and the spec §7 correction

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json` (devDependency + 2 scripts)
- Modify: `.gitignore` (2 lines)
- Create: `tests/landing/e2e/marketing.spec.ts`, `tests/identity/e2e/login.spec.ts`, `tests/dashboard/e2e/guard.spec.ts`
- Modify: spec `:261-278` (the `login.spec.ts` row and the placeholder table)

**Interfaces:**
- Consumes: `tests/` tree; `NEXT_PUBLIC_APP_URL` (this checkout: `http://localhost:3000`).
- Produces: Playwright projects named `public` and `auth`; the `@auth` tag convention Task 6 relies on.

- [ ] **Step 1: Install**

```bash
pnpm add -D @playwright/test && pnpm exec playwright install chromium
```

- [ ] **Step 2: `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/e2e/**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "dot" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "public", use: { ...devices["Desktop Chrome"] }, grepInvert: /@auth/ },
    { name: "auth", use: { ...devices["Desktop Chrome"] }, grep: /@auth/,
      dependencies: ["public"] },
  ],
  webServer: {
    command: isCI ? "pnpm start -p 3000" : "pnpm dev -p 3000",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
```

`testMatch` and Vitest's `include: ["tests/*/unit/**/*.test.ts"]` are disjoint by extension, which is what keeps `.spec.ts` out of `pnpm test`.

- [ ] **Step 3: Scripts and ignore**

`package.json` scripts:

```json
    "test:e2e": "playwright test --project public",
    "test:e2e:auth": "playwright test --project auth",
```

`.gitignore`, in the `# testing` block:

```
/playwright-report/
/test-results/
```

- [ ] **Step 4: `tests/landing/e2e/marketing.spec.ts`**

Copy verified from source: the `<h1>` text is `landing-hero.tsx:50`, footer labels are `landing-footer.tsx:9-12`.

```ts
import { expect, test } from "@playwright/test";

test("landing renders the headline and the feature grid", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/JK Intelligence/);
  await expect(
    page.getByRole("heading", { level: 1, name: /organic performance, in one dashboard/ }),
  ).toBeVisible();
});

test("footer reaches both legal pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole("link", { name: "Terms & Conditions" }).click();
  await expect(page).toHaveURL(/\/terms$/);
});
```

- [ ] **Step 5: `tests/identity/e2e/login.spec.ts` — structure only, no credential round-trip**

The spec's original assertion cannot pass in CI (Known deviations 2): submitting reaches `ci-placeholder.supabase.co`, which fails at DNS, not auth.

```ts
import { expect, test } from "@playwright/test";

test("the login form is served to an anonymous visitor", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page).toHaveTitle(/Sign in/);
  const form = page.getByRole("form", { name: "Sign in" });
  await expect(form.getByLabel("Email")).toBeVisible();
  await expect(form.getByLabel("Password")).toBeVisible();
});

test("empty submission is blocked client-side and does not navigate", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
});
```

- [ ] **Step 6: `tests/dashboard/e2e/guard.spec.ts`**

The 307 target is the measured value from spec §7's table, not a guess.

```ts
import { expect, test } from "@playwright/test";

test("an anonymous /dashboard visit lands on login with the return path", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
});

test("an anonymous /profile visit is guarded the same way", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fprofile$/);
});
```

- [ ] **Step 7: Run the public tier**

Run: `pnpm test:e2e`
Expected: 5 passed. `webServer` boots `pnpm dev`; if port 3000 is already serving, `reuseExistingServer` takes it — kill anything you did not start yourself.

- [ ] **Step 8: Prove the tiers are disjoint**

Run: `pnpm test` then `pnpm test:e2e`
Expected: still `19 passed (19)` from Vitest — Playwright's `.spec.ts` files must not appear there.

- [ ] **Step 9: Correct spec §7, then commit**

Update the `login.spec.ts` row to "form is served; empty submit is blocked client-side", and add one line recording why the credential round-trip moved to the `@auth` tier.

```bash
git add playwright.config.ts package.json pnpm-lock.yaml .gitignore tests specs
git commit -m "test: add the public playwright tier over placeholder-safe pages"
```

---

### Task 6: The two `@auth` specs, local-only

**Files:**
- Create: `tests/dashboard/e2e/overview.spec.ts`, `tests/export/e2e/csv.spec.ts`

**Interfaces:**
- Consumes: Task 5's `auth` project and `@auth` tag; the existing demo account (`NEXT_PUBLIC_DEMO_EMAIL` / `NEXT_PUBLIC_DEMO_PASSWORD`, provisioned by `pnpm db:demo-user`).
- Produces: nothing later tasks need.

- [ ] **Step 1: Confirm the account exists and the flows are read-only**

Run: `pnpm exec playwright --version` (sanity), and re-read the evidence: `grep -rn "insert\|upsert\|\.update(" lib/exports app/api/exports` returns nothing, so a CSV run mutates no rows. The dashboard reads `/api/dashboard/boot` only.

- [ ] **Step 2: Write the login helper**

```ts
// tests/helpers/log-in.ts
import { expect, type Page } from "@playwright/test";

export async function logIn(page: Page) {
  const email = process.env.NEXT_PUBLIC_DEMO_EMAIL;
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error("NEXT_PUBLIC_DEMO_EMAIL / NEXT_PUBLIC_DEMO_PASSWORD not in the environment");
  }
  await page.goto("/auth/login");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}
```

Next loads `.env` for `next dev`, and `webServer` inherits the shell, so both variables arrive without any secret touching a committed file.

- [ ] **Step 3: `tests/dashboard/e2e/overview.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { logIn } from "../../helpers/log-in";

test("@auth the dashboard renders a real metric", async ({ page }) => {
  await logIn(page);
  const metrics = page.getByRole("region", { name: "Performance metrics" })
    .or(page.locator('[aria-label="Performance metrics"]'));
  await expect(metrics.first()).toBeVisible();
  await expect(metrics.first()).toContainText(/Clicks|Impressions/);
});
```

`dashboard-metrics.tsx:58` sets `aria-label="Performance metrics"` on a `<section>`; a section is not a region role by AOM in every case, hence the `or(...)`. Narrow it to whichever the first run reports and delete the alternative — leaving both in the committed file is a hedge, not a test.

- [ ] **Step 4: `tests/export/e2e/csv.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { logIn } from "../../helpers/log-in";

test("@auth the CSV export downloads with a header row", async ({ page }) => {
  await logIn(page);
  const download = page.waitForEvent("download");
  // Read export-menu.tsx for the real trigger label before running; the
  // control is a dropdown item, not a plain button.
  await page.getByRole("button", { name: /export/i }).click();
  await page.getByRole("menuitem", { name: /csv/i }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const path = await file.path();
  const firstLine = (await import("node:fs/promises"))
    .readFileSync ? "" : "";
  expect(firstLine).toBe("");
});
```

**This step is deliberately unfinished and must not be committed as-is.** Replace the `firstLine` block with a real read of the downloaded file's first row and assert it equals `CSV_HEADERS` exported from `@/lib/exports/csv` — the constant exists (`lib/exports/exports.test.ts:10` imports it) and is the single source of truth. Confirm the menu labels against `components/features/data-export/components/export-menu.tsx` first; the names above are unverified.

- [ ] **Step 5: Run them**

Run: `pnpm test:e2e:auth`
Expected: 2 passed, against your real Supabase project. Report the observed metric title and CSV header rather than only the exit code (`RULES.md` §2).

- [ ] **Step 6: Confirm CI cannot reach them**

Run: `pnpm test:e2e` and read the project list. Expected: the `auth` project does not run.

- [ ] **Step 7: Commit**

```bash
git add tests/dashboard/e2e/overview.spec.ts tests/export/e2e/csv.spec.ts tests/helpers
git commit -m "test: add local-only authed e2e for dashboard metrics and csv export"
```

---

### Task 7: The public e2e job in CI

**Files:**
- Modify: `.github/workflows/ci.yml` (one step after Build)

**Interfaces:**
- Consumes: Task 5's public specs; the existing `env:` placeholders at `ci.yml:22-24`; the `.next` build the job already produces.
- Produces: nothing later tasks need.

- [ ] **Step 1: Add the step**

After `- name: Build`:

```yaml
      # Public tier only: it needs no database, which is why the two
      # NEXT_PUBLIC_* placeholders above are enough. Authed specs are
      # local-only by design (docs/superpowers/specs/2026-09-23-...:§7).
      - name: E2E (public)
        run: |
          pnpm exec playwright install --with-deps chromium
          pnpm test:e2e
```

- [ ] **Step 2: Local rehearsal of the exact CI conditions**

The `.next` here was already built with placeholders and measured in spec §7. Re-run the build+start+probe so the CI job is not the first execution of that combination:

```bash
rm -rf .next
NEXT_PUBLIC_SUPABASE_URL=https://ci-placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder \
  pnpm build
NEXT_PUBLIC_SUPABASE_URL=https://ci-placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder \
  pnpm test:e2e
```

Expected: 5 passed. Exported vars beat `.env` because Next stops at `process.env` in its load order.

- [ ] **Step 3: Confirm the placeholder run left nothing behind**

Run: `lsof -nP -iTCP:3000 -sTCP:LISTEN || echo free`
Expected: `free`. Playwright stops its own `webServer`, but check rather than assume (`RULES.md` §5).

- [ ] **Step 4: Rebuild locally, commit**

Run: `pnpm build` (real env), so `.next` stops holding placeholder values.

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the public e2e tier after the build"
```

---

### Task 8: Supersede the per-feature `tests/` convention

Spec §0 decision 2. Two copies of one skill file, hardlinked (inode `104056145`).

**Files:**
- Modify: `docs/conventions/feature-components.md:15-25` (the tree diagram) and `:42`
- Modify: `.claude/skills/feature-component/SKILL.md:25-26` — which is the same inode as `.agents/skills/feature-component/SKILL.md`

**Interfaces:**
- Consumes: Task 4's wording, which the new lines must not contradict.
- Produces: the rule that stops a future feature-component run recreating the drift.

- [ ] **Step 1: Edit the convention doc**

In the `components/features/<slug>/` diagram, delete the `└── tests/  # render/interaction tests, fixtures` line and change the `lib/` comment to `# pure helpers for this feature (tests live in tests/<feature>/unit)`. At `:42`, "tests colocated" becomes "tests in `tests/<feature>/<tier>/`".

- [ ] **Step 2: Edit the skill in place**

Same two ideas at `.claude/skills/feature-component/SKILL.md:25-26`. Use an editing method that writes the existing inode rather than replace-on-rename.

- [ ] **Step 3: Prove the hardlink survived**

Run: `ls -i .claude/skills/feature-component/SKILL.md .agents/skills/feature-component/SKILL.md`
Expected: one identical inode on both lines. If they differ:

```bash
cp .claude/skills/feature-component/SKILL.md /tmp/fc-skill.md
ln -f /tmp/fc-skill.md .agents/skills/feature-component/SKILL.md
ls -i .claude/skills/feature-component/SKILL.md .agents/skills/feature-component/SKILL.md
```

Then diff both against the intended text — `.claude/` is the source of truth per `AGENTS.md`, so a third copy under `.opencode/commands/` needs the same edit if it mentions tests.

- [ ] **Step 4: Commit**

```bash
git add docs/conventions/feature-components.md .claude/skills/feature-component/SKILL.md \
  .agents/skills/feature-component/SKILL.md
git commit -m "docs: point the feature-component convention at tests/<feature>/"
```

---

### Task 9: Integration tier structure (and explicitly not its first slice)

**Files:**
- Create: `tests/helpers/load-test-env.ts`, `tests/helpers/db.ts`
- Create: `tests/fixtures/README.md`
- Modify: `vitest.config.ts` (register the setup file)

**Interfaces:**
- Consumes: Task 1's `integration` project.
- Produces: `hasTestDb: boolean` and the `TEST_*` names that the follow-up RLS task will consume.

**Boundary — read before starting.** Spec §6's merge rule says the RLS gate slice does not land until it has run green against a real Supabase stack, and that stack is not available here (Docker installed but not running; `supabase` CLI not installed). This task therefore ships the plumbing and stops. Writing `rls-gate.test.ts` now would commit never-executed assertions, which `RULES.md` §2 forbids. Its absence belongs in the progress tracker, not in a silent gap.

- [x] **Step 1: `tests/helpers/load-test-env.ts`**

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../../.env.test", import.meta.url));

if (existsSync(file)) {
  // process.loadEnvFile does not override variables the shell already set,
  // which is why every name here is TEST_-prefixed.
  process.loadEnvFile(file);
}

if (!process.env.TEST_SUPABASE_URL) {
  console.warn(
    "[integration] skipped: set TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, " +
      "TEST_SUPABASE_SERVICE_ROLE_KEY and TEST_DEMO_PASSWORD in .env.test",
  );
}
```

- [x] **Step 2: `tests/helpers/db.ts`**

```ts
export const hasTestDb = Boolean(process.env.TEST_SUPABASE_URL);
```

- [x] **Step 3: Register it in the integration project**

Result: done **without the `passWithNoTests` line.** It is not a `TestProjectOptions`
key — with it present `pnpm typecheck` failed `TS2769`, and the CLI flag on
`test:integration` covers the one command that needs it. See Known-deviations 1, which this
supersedes.

```ts
        test: {
          name: "integration",
          include: ["tests/*/integration/**/*.test.ts"],
          setupFiles: ["tests/helpers/load-test-env.ts"],
          passWithNoTests: true,
        },
```

- [x] **Step 4: `tests/fixtures/README.md`**

Record, without values: the four variable names, that `.env.test` is untracked by the existing `.env*` pattern, and the three fixture users the follow-up needs (`client@a` role client on client A, `client@b` role client on client B, `staff@a` role staff on client A) provisioned by service-role `auth.admin.createUser` as `scripts/create-demo-user.mjs:57` already does.

- [x] **Step 5: Verify the plumbing behaves and says why**

Run: `pnpm test:integration`
Expected: the warn line naming `TEST_SUPABASE_URL`, then a green exit. This is the mitigation spec §4.1 requires — a skipped tier that announces itself rather than looking like coverage.

**That expectation was wrong, and the step does not deliver what it claims.** With the tier
empty the warn line never prints: no worker spawns, so no `setupFiles` module is evaluated.
Measured by adding a probe `tests/tenant-isolation/integration/rls-gate.test.ts` — the warning
appeared on stderr next to a passing collect — and deleting it — silence, and `--passWithNoTests`
turned the run green. `globalSetup` is not a fix: it also does not fire on an empty tier, and
pointing it at the same module as `setupFiles` suppressed collection outright. So a green
`pnpm test:integration` today is exactly the silent-green this mitigation exists to prevent.
Spec §4.1 carries the corrected wording; do not re-add the probe, the warning is for the first
real integration file, not for this task.

Run: `pnpm test:all`
Expected: unit `19 passed (19)` / `122 passed (122)`, integration green.

- [ ] **Step 6: Update the progress tracker, naming the gap**

In `context/progress-tracker.md`, add an entry for the migration and one open item in plain terms: the integration tier is wired but holds no test, because the local Supabase stack is unavailable; the first slice is `tests/tenant-isolation/integration/rls-gate.test.ts` with spec §6's four assertions.

- [ ] **Step 7: Full gate, commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

```bash
git add tests/helpers tests/fixtures vitest.config.ts context/progress-tracker.md
git commit -m "test: wire the integration tier's env plumbing, leave the rls slice open

The slice needs a running supabase stack; shipping it unverified would be a
claim we cannot back."
```

---

## Self-review

**Spec coverage.** §3 tree → Tasks 1-3. §4 runner + commands → Task 1, amended in Task 9. §5 unit rules → Task 4. §6 integration → Task 9 (structure) with the slice deferred per its own merge rule. §7 e2e → Tasks 5-6, CI in 7. §8 docs → Tasks 4 and 8, plus spec amendments in 1 and 5. §9 acceptance → the count checks in 1/3/5/9 and the greps in 3 and 8. §10 open questions stay open by design.

**Placeholders.** One deliberate hole: Task 6 Step 4 cannot assert a CSV header row until the menu labels and the downloaded file are read from the running app, and it says so with the exact replacement to make rather than pretending to be finished. Everything else carries real code.

**Type consistency.** `hasTestDb` (Task 9) is the name spec §6 uses. Project names `unit` / `integration` (Task 1) match `--project` flags in Tasks 1, 5, 9. Playwright project names `public` / `auth` (Task 5) match Task 6's command and Task 7's comment. `TEST_` variable names match between Tasks 9 and the spec.
