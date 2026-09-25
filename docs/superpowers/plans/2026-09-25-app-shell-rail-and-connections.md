# App Shell Rail + Connections Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every authenticated page inside one persistent app shell with a left destination rail, and add a `/connections` page that reports, per tenant, which third-party sources have credentials linked — read-only.

**Architecture:** A route group `app/(app)/` gives `/dashboard`, `/connections` and `/profile` a shared server layout without changing any URL (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — "opting specific route segments into sharing a layout, while keeping others out"). The rail is static chrome; it fetches nothing, which is what keeps `/dashboard` prerendered. Connections reads `api_credentials` through the same RLS-scoped, cookie-bound client the tenant gate already uses, after a migration replaces that table's `using (false)` select policy with the tenant rule that already governs `clients`.

**Tech Stack:** Next 16.3.5 App Router (route groups, `RouteContext`), React 19.3, `@supabase/ssr` + Postgres RLS, zod 4, Tailwind 4 tokens, Vitest 5 (unit + integration projects), Playwright (`public` / `auth` projects).

**Spec:** none exists yet — `docs/conventions/feature-components.md` §Checklist requires `context/feature-specs/<nn>-<slug>.md` *before* implementation, so **Task 1 creates both specs from Appendices A and B of this plan.** Read `docs/superpowers/specs/2026-09-24-admin-provisioning-design.md` alongside this: it reserves spec number `07` for the admin panel, establishes the definer-function pattern, and is the source of the left-rail deferral this plan overturns.

## Global Constraints

- **Gate after every task:** `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, all four clean. Baseline at plan authoring: `pnpm test` → **139 passed / 22 files**. The number only grows; a drop means a file was orphaned, not that work got faster.
- **`/dashboard` must still print `○` (static) in `pnpm build`'s route table after every task.** It was made a prerendered shell deliberately to fix 4–5 s switches on Vercel; a server-side session read in the shell would silently make it `ƒ` and re-introduce that. This is the plan's most likely self-inflicted regression.
- Tenant ownership is decided **only** by RLS via `canAccessClient` / `listAccessibleClients` (`RULES.md` §15). No new TypeScript branching on `role` or `client_id` to answer "is this mine?". `authAgent` must not grow a copy of the rule.
- Credentials never appear in a response body, a log line, or a test snapshot (`RULES.md` §16). `credential_reference` is not read by anything in this plan.
- Migrations are new timestamped files under `supabase/migrations/`, applied with `pnpm db:migrate`; **never edit an applied migration** (`RULES.md` §16).
- **Zero new dependencies and zero new `components/ui/*`.** The rail is `Link` + token classes; `ui-context.md:187` already fixes its appearance (`bg-surface border-r border-default`). `components/ui/*` and `lib/supabase/*` are protected (`RULES.md` §17).
- No `unstable_cache` on any connections read. A cookie-bound client inside a cached function keys the entry on nothing while deriving its rows from the caller — the exact cross-user leak closed in the 2026-09-23 tenant-gate step (`context/architecture-context.md` invariant 4-5).
- Tests live in `tests/<feature>/<tier>/`, imported through `@/` not relatively (`RULES.md` §13). **Create no new test folders**: `app-shell` and `connections` own no tier, so each test goes under the domain that owns the invariant it protects — see Appendix C for the routing of all seven new files.
- Commit at the end of each task. **Do not push** — `RULES.md` §7 requires `git pull` from `origin main` first, and pushing is not authorized here.
- Leave no orphaned server on port 3000/3001 when a task ends (`RULES.md` §5). This checkout's `.next` may hold CI-placeholder env; a local rebuild replacing it is expected.
- A task that falsifies a doc rewrites that doc in the same task (`RULES.md` §14).

## Known deviations from recorded decisions

Found while planning. Each is a reversal of something written down, so it is stated rather than slipped through.

1. **Overturns the left-rail deferral.** `AGENTS.md`-adjacent memory and `2026-09-24-admin-provisioning-design.md:53` deferred the rail until destinations passed six, and this plan ships **three**. It proceeds because it was asked for directly and because the deferral's stated reason was width cost, not a prohibition. If the width trade-off is still unwelcome, Task 3 is the one to reject; Tasks 1-2 and 4-8 stand without it.
2. **`ui-context.md:186-187` already specifies this rail** ("top navbar, left sidebar (collapsible)") and it was never built. The doc was aspirational, not wrong, so Task 3 conforms to it instead of amending it — except for "collapsible", which is dropped (Appendix A §Non-goals).
3. **No role-gated destinations.** `visibleDestinations(role)` has no live consumer until `/admin` exists, so the registry is role-blind and ships the same three rows to everyone. Building the filter now would be the predicted abstraction `RULES.md` §3 forbids. The admin panel adds its row plus the filter in its own change.
4. **Connections is read-only.** Per the resolved fork: `api_credentials` gains a select policy and a status surface; no insert, delete, or "Connect" write path ships. A supported source renders a `disabled` Connect with its reason in the copy and the page intro; Google/Meta/other OAuth providers render a "Coming soon" badge and no control at all, because a button that can never be enabled on a source with no key-paste flow is the fake affordance the fork ruled out. Nothing consumes the sync queue (`worker.ts` → `mock_completed`, Open Question 2), so a stored Google or Meta token would be a live credential with zero readers and only `RULES.md` §16 standing between a breach and a tenant's account.
5. **No new `source` values.** `google_ads` / `meta_ads` are *not* added to the `api_credentials_source_check` enum or `SOURCES` (`types/metrics.ts:1`), because that union also drives `persist_metrics`, `sourceSchema` and every metrics read. Unsupported providers exist only as display catalog entries.

---

### Task 1: Route group, without a layout yet

Mechanical: relocate the two authenticated pages under `app/(app)/` and prove the URLs and the build did not move. Doing this as its own change means a later diff that adds a layout can be read without a rename buried in it. `app/(app)` has no dotfile-collision risk (`()` is a legal directory name), and no test imports a page module — `grep -rn "@/app/" tests/` returns seven API-route imports and nothing under `app/dashboard` or `app/profile`, so the move breaks no specifier.

**Files:**
- Move: `app/dashboard/page.tsx` → `app/(app)/dashboard/page.tsx`
- Move: `app/dashboard/dashboard-view.tsx` → `app/(app)/dashboard/dashboard-view.tsx`
- Move: `app/profile/page.tsx` → `app/(app)/profile/page.tsx`
- Read first: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`, `next.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the directory `app/(app)/` that every later page task writes into, and the fact that URLs are unchanged.

- [ ] **Step 1: Read the framework doc — this Next is a fork of what you remember (`RULES.md` §12)**

Confirm three things from `route-groups.md` before touching anything: the group folder is "not included in the route's URL path"; the full-page-reload caveat applies only to *multiple root layouts* (this repo keeps one `app/layout.tsx`, so it does not apply); and conflicting paths (`(a)/about` + `(b)/about`) are an error. The move creates no second root layout and no duplicate path.

- [ ] **Step 2: Check `next.config.ts` for path-keyed config that a rename would orphan**

```bash
grep -n "dashboard\|profile\|source:\|outputFileTracingIncludes" next.config.ts
```
Expected: `outputFileTracingIncludes` keyed only on `"/api/exports/**"` (PDF font tracing) and CSP/headers with no page-path keys. If any key does name `dashboard` or `profile` as a *file* path rather than a URL, stop — it needs updating in this task, and `outputFileTracingIncludes` keys are URLs, so it will not.

- [ ] **Step 3: Move the three files**

```bash
mkdir -p "app/(app)"
git mv app/dashboard "app/(app)/dashboard"
git mv app/profile "app/(app)/profile"
ls "app/(app)/dashboard" "app/(app)/profile"
```
Expected: `page.tsx dashboard-view.tsx` and `page.tsx`. `git mv` of the directory keeps history, which matters because Task 3 makes these files' chrome redundant.

- [ ] **Step 4: Fix the one relative import**

`app/(app)/dashboard/page.tsx:4` imports the view by relative path, which still resolves — verify rather than assume:

```bash
pnpm typecheck
```
Expected: silent. (Both files moved together, so `./dashboard-view` is still correct. Nothing else in the tree referenced these paths.)

- [ ] **Step 5: Prove the URLs are unchanged**

Run `pnpm build` and read the route table. Expected, verbatim: `/dashboard` still `○`, `/profile` present, and **no new `/(app)/...` entry** — a route group must not appear in a URL. Then:

```bash
pnpm test:e2e
```
Expected: 6 public passed, including `tests/dashboard/e2e/guard.spec.ts`, whose assertion is `toHaveURL(/\/auth\/login\?next=%2Fdashboard$/)` — that `next` value is the proof the path did not change.

- [ ] **Step 6: Full gate, then commit**

```bash
pnpm test && pnpm lint
git add -A app
git commit -m "refactor(routes): group authenticated pages under app/(app) ahead of a shared shell"
```

- [ ] **Step 7: Write the two feature specs (required by `docs/conventions/feature-components.md` §Checklist 1)**

Create `context/feature-specs/08-app-shell.md` with the full text of Appendix A, and `context/feature-specs/09-connections.md` with the full text of Appendix B. Copy verbatim — do not paraphrase, and do not trim the Non-goals sections; they are the part a future reviewer needs. Format (front-matter, heading order) follows `context/feature-specs/06-data-export.md`; read that file first. `07` stays reserved for the admin panel.

```bash
git add context/feature-specs/08-app-shell.md context/feature-specs/09-connections.md
git commit -m "docs(specs): app shell rail and read-only connections feature specs"
```

---

### Task 2: Destination registry + the guard that must agree with it

`/connections` must be protected before any link points at it. The registry in `lib/navigation/destinations.ts` is the single list the rail renders from; the proxy's `PROTECTED_PREFIXES` in `lib/auth/routing.ts:22` is the list that actually guards. Two lists that can drift is a security bug, so this task adds the third thing that makes drift impossible: a unit test asserting every destination is protected. `lib/navigation/` is a cross-cutting primitive with no owning feature, which per `AGENTS.md`'s table makes `platform` its test home — the same slot `lib/rate-limit.ts` occupies.

**Files:**
- Create: `lib/navigation/destinations.ts`
- Modify: `lib/auth/routing.ts:22` (`PROTECTED_PREFIXES`)
- Create: `tests/platform/unit/destinations.test.ts`
- Modify: `tests/identity/unit/routing.test.ts` (append two cases inside the existing `describe`)
- Create: `tests/identity/e2e/connections-guard.spec.ts`

**Interfaces:**
- Consumes: `resolveProxyAction(path, hasSession)` from `lib/auth/routing` — returns `{ type: "redirect-login", next }` for a protected path without a session.
- Produces: `APP_DESTINATIONS: readonly AppDestination[]`, `AppDestination = { href: string; label: string; icon: DestinationIcon }`, `DestinationIcon`, and `activeDestination(pathname: string): string | null`. Task 3 renders them; Task 6 links to `/connections`.

- [ ] **Step 1: Write the failing registry test**

Create `tests/platform/unit/destinations.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveProxyAction } from "@/lib/auth/routing";
import {
  APP_DESTINATIONS,
  activeDestination,
} from "@/lib/navigation/destinations";

describe("activeDestination", () => {
  it("matches an exact destination", () => {
    expect(activeDestination("/connections")).toBe("/connections");
  });

  it("matches a nested route to its destination", () => {
    expect(activeDestination("/connections/detail")).toBe("/connections");
  });

  it("returns null for a path outside the rail", () => {
    expect(activeDestination("/")).toBeNull();
    expect(activeDestination("/dashboardx")).toBeNull();
  });

  it("keeps the registry flat so no href can shadow another", () => {
    // activeDestination's longest-href tie-break is unreachable while no two
    // hrefs nest. If a nested destination is added, this fails: that is the
    // moment the tie-break needs its own case.
    const hrefs = APP_DESTINATIONS.map((d) => d.href);
    for (const outer of hrefs) {
      for (const inner of hrefs) {
        expect(inner.startsWith(`${outer}/`)).toBe(false);
      }
    }
  });
});

describe("APP_DESTINATIONS", () => {
  it("renders dashboard, connections and profile in that order", () => {
    expect(APP_DESTINATIONS.map((d) => d.href)).toEqual([
      "/dashboard",
      "/connections",
      "/profile",
    ]);
  });

  it("keeps every href unique and absolute", () => {
    const hrefs = APP_DESTINATIONS.map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith("/")).toBe(true);
  });

  it("protects every destination it renders", () => {
    // The rail is the only place a user learns the app has a `/connections`.
    // A destination absent from PROTECTED_PREFIXES still renders, links, and
    // serves its page to an anonymous visitor — so the two lists may not drift.
    for (const { href } of APP_DESTINATIONS) {
      expect(resolveProxyAction(href, false)).toEqual({
        type: "redirect-login",
        next: href,
      });
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm test destinations
```
Expected: FAIL — `Cannot find module '@/lib/navigation/destinations'`. (`pnpm test destinations` filters; `pnpm test -- destinations` silently runs everything — `RULES.md` §13.)

- [ ] **Step 3: Write the registry**

Create `lib/navigation/destinations.ts`:

```ts
/**
 * The rail's destination list. Icons are string keys, not components, so this
 * module stays importable from a node-tier unit test; `app-nav.tsx` owns the
 * key -> Lucide mapping.
 */
export const DESTINATION_ICONS = ["dashboard", "connections", "profile"] as const;

export type DestinationIcon = (typeof DESTINATION_ICONS)[number];

export interface AppDestination {
  href: string;
  label: string;
  icon: DestinationIcon;
}

export const APP_DESTINATIONS: readonly AppDestination[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/connections", label: "Connections", icon: "connections" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

/** The destination whose href claims `pathname`, longest href winning. */
export function activeDestination(pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of APP_DESTINATIONS) {
    const claims = pathname === href || pathname.startsWith(`${href}/`);
    if (claims && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
```

- [ ] **Step 4: Register `/connections` as protected**

In `lib/auth/routing.ts:22`:

```ts
const PROTECTED_PREFIXES = ["/dashboard", "/connections", "/profile"];
```

- [ ] **Step 5: Extend the identity guard test**

In `tests/identity/unit/routing.test.ts`, add to the two existing cases at `:29` and `:40` so the new prefix sits beside its siblings rather than in a parallel describe:

```ts
    expect(resolveProxyAction("/connections", false)).toEqual({
      type: "redirect-login",
      next: "/connections",
    });
    expect(resolveProxyAction("/connections/atlas.example", false)).toEqual({
      type: "redirect-login",
      next: "/connections/atlas.example",
    });
```
and, in the `passes protected routes for authenticated users` case:

```ts
    expect(resolveProxyAction("/connections", true)).toEqual({ type: "pass" });
```

- [ ] **Step 6: Run the unit tier**

```bash
pnpm test
```
Expected: 139 + 7 new = **146 passed / 23 files** (one new file: `tests/platform/unit/destinations.test.ts`). All four `activeDestination` cases and all three `APP_DESTINATIONS` cases green, including the parity test that would fail if Step 4 were skipped. Step 5 adds assertions *inside* two existing `routing.test.ts` cases, so it moves no count.

- [ ] **Step 7: Add the anonymous-bounce e2e**

Create `tests/identity/e2e/connections-guard.spec.ts`. No `@auth` tag: it needs no session, so it runs in CI.

```ts
import { expect, test } from "@playwright/test";

// A destination that renders in the rail must bounce anonymous visitors before
// it ever reaches a page module — this passes while /connections 404s for a
// signed-in user, because proxy.ts decides on the path, not the route table.
test("an anonymous /connections visit lands on login with the return path", async ({
  page,
}) => {
  await page.goto("/connections");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fconnections$/);
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
});
```

- [ ] **Step 8: Verify the e2e**

```bash
pnpm test:e2e
```
Expected: 7 public passed. If the new spec fails on a 404 rather than a redirect, `proxy.ts`'s `matcher` is excluding the path — read `proxy.ts`'s matcher before editing anything else.

- [ ] **Step 9: Full gate, then commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add lib/navigation lib/auth/routing.ts tests/platform tests/identity
git commit -m "feat(navigation): destination registry with a proxy-parity guard for /connections"
```

---

### Task 3: The rail, and the chrome it makes redundant

`AppShell` is a server component (no `"use client"`): it renders the rail plus a content column, and the only client island is `AppNav`, which needs `usePathname()` for the active state. The shell reads no session and calls no data function — that single rule is what keeps `/dashboard` at `○`. Two consequences the executor must handle rather than discover: `EmptyShell` (`app/(app)/dashboard` → `dashboard.tsx:86`) and `Dashboard`'s own root `<div>` both re-declare page chrome that the rail now owns, and the `2026-09-25` mobile lesson applies — an `overflow-x-auto` clipper needs `relative`, or `sr-only` descendants escape it and size the document.

**Files:**
- Create: `components/features/app-shell/index.ts`
- Create: `components/features/app-shell/components/app-shell.tsx`
- Create: `components/features/app-shell/components/app-nav.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `tests/dashboard/e2e/rail.spec.ts` (`@auth`)
- Modify: `components/features/dashboard/components/dashboard.tsx:86-102` (`EmptyShell`)

**Interfaces:**
- Consumes: `APP_DESTINATIONS`, `activeDestination`, `DestinationIcon` from Task 2.
- Produces: `AppShell` (`{ children: React.ReactNode }`), rendered by `app/(app)/layout.tsx` for every page under the group.

- [ ] **Step 1: The rail nav (client, because active state needs the pathname)**

Create `components/features/app-shell/components/app-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plug, UserRound } from "lucide-react";
import {
  APP_DESTINATIONS,
  activeDestination,
  type DestinationIcon,
} from "@/lib/navigation/destinations";
import { cn } from "@/lib/utils";

const ICONS: Record<DestinationIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  connections: Plug,
  profile: UserRound,
};

export function AppNav() {
  const pathname = usePathname();
  const active = activeDestination(pathname);

  return (
    <>
      {/* lg+: the persistent rail ui-context.md's Layout Patterns already calls for. */}
      <nav
        aria-label="Sections"
        className="hidden lg:flex lg:sticky lg:top-0 lg:h-svh lg:w-60 lg:shrink-0 lg:flex-col border-r border-default bg-surface"
      >
        <div className="flex h-16 items-center gap-2.5 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold text-primary-foreground">
            J
          </div>
          <span className="truncate font-serif text-lg font-medium tracking-tight">
            JK Intelligence
          </span>
        </div>
        <ul className="flex flex-col gap-1 px-3">
          {APP_DESTINATIONS.map((destination) => {
            const Icon = ICONS[destination.icon];
            const isSelected = destination.href === active;
            return (
              <li key={destination.href}>
                <Link
                  href={destination.href}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none",
                    isSelected
                      ? "bg-accent-primary-dim text-foreground"
                      : "text-text-muted hover:bg-subtle hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {destination.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Below lg: a horizontal strip. `relative` is load-bearing — this is the
          positioned clipper, so an abspos/sr-only descendant cannot escape it and
          reserve dead horizontal scroll (2026-09-25 dashboard mobile defect). */}
      <nav
        aria-label="Sections"
        className="relative flex items-center gap-1 overflow-x-auto border-b border-default bg-surface px-3 py-2 lg:hidden"
      >
        {APP_DESTINATIONS.map((destination) => {
          const isSelected = destination.href === active;
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                isSelected
                  ? "bg-accent-primary-dim text-foreground"
                  : "text-text-muted",
              )}
            >
              {destination.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: The shell**

Create `components/features/app-shell/components/app-shell.tsx`:

```tsx
import { AppNav } from "./app-nav";

/**
 * Server component, and it must stay one: a session read here would make
 * /dashboard dynamic again, which is the 4-5s-switch defect the client-side
 * boot fetch was built to fix. The rail renders no user data.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full flex-col lg:flex-row">
      <AppNav />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
```

Create `components/features/app-shell/index.ts`:

```ts
export { AppShell } from "./components/app-shell";
```

Create `app/(app)/layout.tsx`:

```tsx
import { AppShell } from "@/components/features/app-shell";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 3: Stop `EmptyShell` from re-declaring what the rail now owns**

In `components/features/dashboard/components/dashboard.tsx:86-102`, drop the inner `<header>` (brand + `accountMenu`) — the rail carries the brand, and `accountMenu` stays wired where it has always worked, `DashboardHeader`. Replace the whole function:

```tsx
function EmptyShell({ message }: { message: string }) {
  return (
    <div className="flex min-h-svh w-full min-w-0 flex-1 flex-col font-sans antialiased bg-background text-foreground">
      <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <Card>
          <CardContent className="py-12 text-center text-sm text-text-muted">{message}</CardContent>
        </Card>
      </main>
    </div>
  );
}
```
and update its two call sites (`dashboard.tsx:152-157`, `:161-166`) to drop the `accountMenu` prop:

```tsx
      <EmptyShell message="No reporting client is assigned to your account yet." />
```
```tsx
      <EmptyShell message={`No metrics have been synced for ${selectedClient.name} yet.`} />
```

`accountMenu` and `exportMenu` stay on `DashboardProps` — they are passed into `DashboardHeader`, so the props are still consumed and must not be removed.

- [ ] **Step 4: Prove `/dashboard` is still statically prerendered**

```bash
pnpm build
```
Expected: `/dashboard` → `○`. If it reads `ƒ`, the shell reached for request-scoped data; revert Step 2's import list and find it. This is the constraint the whole task hangs on.

- [ ] **Step 5: Look at it in a browser**

```bash
pnpm dev -p 3000
```
Sign in with the demo credentials (they come from server-side `DEMO_EMAIL`/`DEMO_PASSWORD`; the card renders only if both are set in `.env`). Check: rail visible at 1280 with **Dashboard** highlighted on `/dashboard`; still highlighted on `/dashboard?client=…&days=90&tab=queries`; **Profile** highlighted on `/profile`; at 390 the strip replaces the rail and no horizontal scrollbar exists on the page. Kill the server when done.

- [ ] **Step 6: Prove no page-level overflow was introduced**

Create `tests/dashboard/e2e/rail.spec.ts` (`@auth` — needs a session, so it is local-only, joining `tab-deep-link.spec.ts`):

```ts
import { expect, test } from "@playwright/test";

import { logIn } from "../helpers/log-in";

test.describe("@auth app shell rail", () => {
  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  test("renders the three destinations with the active one marked", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Sections" }).first();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Connections" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("the rail reserves no horizontal scroll at phone widths", async ({ page }) => {
    for (const width of [320, 390, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/dashboard");
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    }
  });
});
```

```bash
pnpm test:e2e:auth
```
Expected: the two new tests pass beside the existing authed specs. `logIn` resolves the `toHaveURL(/\/dashboard$/)` assertion unchanged.

- [ ] **Step 7: Docs this task falsifies**

In `context/ui-context.md` §Layout Patterns, mark the rail built and drop "(collapsible)" from the dashboard line, so the doc describes what ships:

```md
- **Dashboard:** full-viewport, left destination rail (persistent at `lg+`, a horizontal
  strip below), page header inside the content column, main content area.
- **Sidebar (`AppNav`):** `bg-surface border-r border-default` at `lg+`, `w-60`, sticky at
  full viewport height. Destinations come from `lib/navigation/destinations.ts`; the shell
  reads no session so `/dashboard` stays prerendered. Below `lg` the same list renders as a
  `relative overflow-x-auto` strip — the `relative` is what keeps `sr-only` descendants from
  sizing the document. Not collapsible.
```

- [ ] **Step 8: Full gate, then commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
git add components/features/app-shell "app/(app)/layout.tsx" components/features/dashboard tests docs context
git commit -m "feat(shell): persistent destination rail across authenticated pages"
```

---

### Task 4: Make `api_credentials` tenant-readable under the rule that already exists

`api_credentials` currently has `for select to authenticated using (false)` (`20260917000000_seo_poc.sql:169`) and no `select` grant for `authenticated` at all (`:201` revokes, `:210` grants service_role only). That posture was correct while nothing read the table. This task replaces it with the *same* two-helper predicate `clients_select_authenticated` (`:155-160`) uses — no new ownership logic, and the `private.current_user_role()` / `current_user_client_id()` helpers stay the only path from `auth.uid()` to a tenant.

**Files:**
- Create: `supabase/migrations/20260925000000_connections_read.sql`
- Create: `tests/tenant-isolation/integration/credentials-visibility.test.ts`
- Modify: `tests/fixtures/identity-users.ts` (add a credential row per fixture client)

**Interfaces:**
- Consumes: `private.current_user_role()`, `private.current_user_client_id()`, `authenticated` role grants.
- Produces: a `public.api_credentials` table an `authenticated` request can `select` from, restricted to rows whose `client_id` the caller may see. Task 5's read depends on this and on nothing else.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260925000000_connections_read.sql`:

```sql
-- The Connections page reports which sources a tenant has linked. That is a
-- read over api_credentials, which until now had no readable rows for any
-- non-service role (using (false)). This is not a widening of the tenant rule:
-- the predicate is the one clients_select_authenticated already applies, so
-- Postgres keeps deciding visibility and no TypeScript helper grows the rule.
--
-- Deliberate: the policy is row-level, so `credential_reference` is selectable
-- by a tenant that can see the row. That is acceptable because the column holds
-- an opaque Vault *reference*, not a secret, nothing in this app decrypts it,
-- and no response, log line or cache entry in this change carries it. Recorded
-- as an accepted limitation in context/feature-specs/09-connections.md.
drop policy api_credentials_no_direct_access on public.api_credentials;

create policy api_credentials_select_tenant_or_admin on public.api_credentials
  for select to authenticated
  using (
    private.current_user_role() = 'admin'
    or private.current_user_client_id() = api_credentials.client_id
  );

grant select on public.api_credentials to authenticated;
```

Do **not** add an `insert`/`update`/`delete` policy — Task 4's scope is a read, and an unguarded write path to a credential table is the thing `RULES.md` §16 exists to prevent.

- [ ] **Step 2: Apply it**

```bash
pnpm exec supabase start   # if the local stack is not already up (Docker Desktop)
pnpm db:migrate
```
Expected: the runner reports `20260925000000_connections_read.sql` applied, and `public.schema_migrations` gains the row. `supabase/config.toml` keeps `[db.migrations].enabled = false`, so the CLI will not double-apply it.

- [ ] **Step 3: Seed a credential per fixture client**

In `tests/fixtures/identity-users.ts`, extend the fixture so Step 4's assertions have rows. Add after the `ensureLink` helpers:

```ts
/**
 * One `api_credentials` row per fixture client, so the visibility test has a
 * positive case. The reference is a syntactically valid, obviously fake Vault
 * uuid: nothing decrypts it, and the regex in api_credentials_reference_shape
 * is the only thing it must satisfy.
 */
export const FAKE_VAULT_REFERENCE =
  "vault:00000000-0000-4000-8000-0000000000ff";

async function ensureCredential(db: SupabaseClient, clientId: string) {
  const { error } = await db.from("api_credentials").upsert(
    {
      client_id: clientId,
      source: "semrush",
      credential_reference: FAKE_VAULT_REFERENCE,
    },
    { onConflict: "client_id,source" },
  );
  if (error) throw new Error(`fixture credential: ${error.message}`);
}
```
and inside `provisionFixtures()`, after the `ensureLink` block, before `return`:

```ts
  await ensureCredential(db, a);
  await ensureCredential(db, b);
```
The insert goes through `adminDb()` (service role), which `tests/fixtures/README.md:41` prescribes: inserts via service-role, assertions via the user-scoped client.

- [ ] **Step 4: Write the policy's live test — at the PostgREST boundary, not through our helper**

Create `tests/tenant-isolation/integration/credentials-visibility.test.ts`. It follows `rls-gate.test.ts` in shape, including the `vi.mock("next/headers")` placement (a cookie-bound client needs a session to scope by), but it **does not import `lib/db/repository`**: it queries PostgREST the way any `authenticated` caller would. The thing under test is the SQL policy, and asserting it through our own read helper would let a future service-role switch in Task 5 look green here while the policy had already regressed. This file is the database-level evidence the migration claims — there is no separate psql probe.

```ts
import { beforeAll, describe, expect, it, vi } from "vitest";

import { hasTestDb } from "../../helpers/db";

// Second live-RLS slice, over api_credentials. Nothing is faked at PostgREST,
// so a green run is evidence about the policy, not about a mock. NEVER EXECUTED
// in CI — see the deviation note at the top of this plan; quote the skip line in
// context/progress-tracker.md rather than claiming coverage.
vi.mock("next/headers", () => ({
  cookies: async () => getCurrentCookieStore(),
}));
vi.mock("server-only", () => ({}));

import {
  FIXTURE_USERS,
  provisionFixtures,
  withSession,
  getCurrentCookieStore,
  type TestClients,
} from "../../fixtures/identity-users";

// The columns the Connections page needs. Deliberately not
// `credential_reference`: RULES.md §16 keeps a credential out of every response
// and log line, and a test that selected it would be the first place that
// invariant got quietly relaxed. Task 5's unit test owns the "we never read the
// reference" assertion for the application path.
const COLUMNS = "client_id,source,created_at";

interface CredentialRowShape {
  client_id: string;
  source: string;
  created_at: string;
}

describe.skipIf(!hasTestDb)("api_credentials visibility against live RLS", () => {
  let clients: TestClients;

  beforeAll(async () => {
    clients = await provisionFixtures();
  });

  // Imported inside the call so it resolves after the next/headers mock is
  // registered, and picks up whichever fixture session withSession installed.
  async function credentials(): Promise<CredentialRowShape[]> {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const db = await createServerSupabaseClient();
    const { data, error } = await db
      .from("api_credentials")
      .select(COLUMNS)
      .order("client_id");
    if (error) throw new Error("Database operation failed");
    return data as CredentialRowShape[];
  }

  it("client@a sees its own tenant's credential and no other", async () => {
    await withSession(FIXTURE_USERS.clientA, async () => {
      const rows = await credentials();
      expect(rows.map((row) => row.client_id)).toEqual([clients.a]);
      expect(rows[0].source).toBe("semrush");
    });
  });

  it("staff@a reaches the same row, which is the whole staff grant", async () => {
    await withSession(FIXTURE_USERS.staffA, async () => {
      const rows = await credentials();
      expect(rows.map((row) => row.client_id)).toEqual([clients.a]);
    });
  });

  it("an admin sees every provisioned tenant", async () => {
    await withSession("admin@rls-test.local", async () => {
      const rows = await credentials();
      expect(rows.map((row) => row.client_id)).toEqual(
        expect.arrayContaining([clients.a, clients.b]),
      );
    });
  });

  it("a cookie-less call throws rather than returning everything", async () => {
    await withSession(null, async () => {
      // PostgREST runs this as `anon`, whose SELECT grant
      // 20260917000000_seo_poc.sql:201 revoked and this migration does not
      // re-grant. An accidental [] would be the softer, easier-to-miss bug —
      // the same argument rls-gate.test.ts:65-76 makes.
      await expect(credentials()).rejects.toThrow("Database operation failed");
    });
  });
});
```
The first two cases are the interesting pair: `client` and `staff` resolve to the identical row set because the predicate is `current_user_client_id()`, not a role test — which is what keeps this migration from becoming a second, drifting copy of the ownership rule.

- [ ] **Step 5: Run the live tier**

```bash
pnpm test:integration
```
Expected with a filled `.env.test`: `4 passed` (this file) alongside the existing `rls-gate` run. Without one: the file is reported skipped — **quote that skip line verbatim in `context/progress-tracker.md`**. `--passWithNoTests` makes silence indistinguishable from coverage, which is the trap `tests/tenant-isolation/integration/README` notes.

- [ ] **Step 6: Full gate, then commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```
Expected: unit tier still **146 / 23 files**; the migration is inert to it (no TypeScript in the app reads the table yet), and `pnpm build` never touches RLS.

```bash
git add supabase/migrations tests/tenant-isolation tests/fixtures
git commit -m "feat(db): let a tenant read its own api_credentials rows"
```

---

### Task 5: The read, and the pure join that is worth testing

`listConnections()` lives in `lib/db/repository.ts` rather than a sibling module because it must reuse `databaseOperation`, `idSchema`, `timestampSchema` and `createServerSupabaseClient`, all private to that file; exporting them for a neighbour would be the larger change. The interesting logic — pairing clients with credential rows, dropping orphans, ordering — is a pure function in `lib/connections/status.ts`, because `RULES.md` §13 forbids mocking inside business logic.

**Files:**
- Create: `lib/connections/status.ts`
- Create: `types/connections.ts`
- Modify: `lib/db/repository.ts` (append the schema + `listConnections`)
- Create: `tests/tenant-isolation/unit/connections-status.test.ts`
- Create: `tests/tenant-isolation/unit/connections-read.test.ts`
- Create: `tests/helpers/fake-postgrest.ts` (the PostgREST fake lifted out of `repository.test.ts`)
- Modify: `tests/tenant-isolation/unit/repository.test.ts` (import the fake, don't duplicate it)

**Interfaces:**
- Consumes: `listAccessibleClients()` (existing, `lib/db/repository.ts:282`), `createServerSupabaseClient`, `databaseOperation`, the `authenticated` grant from Task 4.
- Produces:
  - `types/connections.ts`: `SourceConnection = { source: Source; linkedAt: string }`, `ClientConnections = { client: DashboardClient; sources: SourceConnection[] }`, `CredentialRow = { clientId: string; source: Source; linkedAt: string }`.
  - `buildConnectionStates(clients: DashboardClient[], rows: CredentialRow[]): ClientConnections[]`
  - `listConnections(): Promise<ClientConnections[]>`

- [ ] **Step 1: The types**

Create `types/connections.ts`:

```ts
import type { DashboardClient } from "@/types/dashboard";
import type { Source } from "@/types/metrics";

export interface SourceConnection {
  source: Source;
  /** ISO timestamp from api_credentials.created_at — never the reference itself. */
  linkedAt: string;
}

export interface ClientConnections {
  client: DashboardClient;
  /** Sources with a credential row, in SOURCES order. Absent means not connected. */
  sources: SourceConnection[];
}

/** A credential row keyed for joining, camelCase like the rest of the read layer. */
export interface CredentialRow {
  clientId: string;
  source: Source;
  linkedAt: string;
}
```

- [ ] **Step 2: Write the failing pure-function tests**

Create `tests/tenant-isolation/unit/connections-status.test.ts`. It lives here, not in a `connections/` folder, because the invariant it protects is "one tenant's rows never land in another tenant's render" — `tenant-isolation` owns that (`AGENTS.md`'s folder table, `feature-components.md`'s "test belongs under the domain that owns the invariant").

```ts
import { describe, expect, it } from "vitest";

import { buildConnectionStates } from "@/lib/connections/status";
import type { CredentialRow } from "@/types/connections";
import type { DashboardClient } from "@/types/dashboard";

const A: DashboardClient = {
  id: "00000000-0000-4000-8000-00000000000a",
  name: "Atlas Coffee",
  domain: "atlas.example",
  initials: "AC",
};
const B: DashboardClient = {
  id: "00000000-0000-4000-8000-00000000000b",
  name: "Borealis Bikes",
  domain: "borealis.example",
  initials: "BB",
};
const GSC = "2026-09-01T00:00:00.000Z";
const SEMRUSH = "2026-09-12T00:00:00.000Z";

const row = (over: Partial<CredentialRow>): CredentialRow => ({
  clientId: A.id,
  source: "gsc",
  linkedAt: GSC,
  ...over,
});

describe("buildConnectionStates", () => {
  it("emits one entry per client, in the caller's order", () => {
    const states = buildConnectionStates([A, B], []);
    expect(states.map((s) => s.client.id)).toEqual([A.id, B.id]);
    expect(states[0].sources).toEqual([]);
  });

  it("attaches a credential to its own client only", () => {
    const states = buildConnectionStates(
      [A, B],
      [row({}), row({ clientId: B.id, source: "semrush", linkedAt: SEMRUSH })],
    );
    expect(states[0].sources).toEqual([{ source: "gsc", linkedAt: GSC }]);
    expect(states[1].sources).toEqual([{ source: "semrush", linkedAt: SEMRUSH }]);
  });

  it("orders sources by SOURCES, not by arrival", () => {
    const states = buildConnectionStates(
      [A],
      [
        row({ source: "semrush", linkedAt: SEMRUSH }),
        row({ source: "ga4", linkedAt: GSC }),
        row({ source: "gsc", linkedAt: GSC }),
      ],
    );
    expect(states[0].sources.map((s) => s.source)).toEqual(["gsc", "ga4", "semrush"]);
  });

  it("drops a row whose client is not in the visible set", () => {
    // Defensive, not the security boundary: RLS already filtered the rows. If a
    // future read ever uses the service-role client, this is what keeps a
    // foreign row out of the render — so the case stays asserted.
    const FOREIGN = "00000000-0000-4000-8000-00000000000f";
    expect(buildConnectionStates([A], [row({ clientId: FOREIGN })])[0].sources).toEqual([]);
  });

  it("keeps the earliest linkedAt when a source somehow appears twice", () => {
    const states = buildConnectionStates(
      [A],
      [
        row({ linkedAt: SEMRUSH }),
        row({ source: "gsc", linkedAt: GSC }),
      ],
    );
    expect(states[0].sources).toEqual([{ source: "gsc", linkedAt: GSC }]);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

```bash
pnpm test connections-status
```
Expected: FAIL — `Cannot find module '@/lib/connections/status'`.

- [ ] **Step 4: Write the pure join**

Create `lib/connections/status.ts`:

```ts
import { SOURCES, type Source } from "@/types/metrics";
import type { DashboardClient } from "@/types/dashboard";
import type { ClientConnections, CredentialRow } from "@/types/connections";

/**
 * Pairs the RLS-visible client list with the RLS-visible credential rows. Both
 * inputs are already tenant-scoped by Postgres; this function's only contract
 * is that an unexpected clientId in `rows` produces nothing, so a future
 * service-role read could not leak through the render.
 */
export function buildConnectionStates(
  clients: DashboardClient[],
  rows: CredentialRow[],
): ClientConnections[] {
  const byClient = new Map<string, Map<Source, string>>();
  for (const client of clients) byClient.set(client.id, new Map());

  for (const row of rows) {
    const bucket = byClient.get(row.clientId);
    if (!bucket) continue;
    const existing = bucket.get(row.source);
    if (existing === undefined || row.linkedAt < existing) {
      bucket.set(row.source, row.linkedAt);
    }
  }

  return clients.map((client) => {
    const bucket = byClient.get(client.id)!;
    const sources = SOURCES.filter((source) => bucket.has(source)).map((source) => ({
      source,
      linkedAt: bucket.get(source)!,
    }));
    return { client, sources };
  });
}
```

- [ ] **Step 5: Run them to verify they pass**

```bash
pnpm test connections-status
```
Expected: 5 passed.

- [ ] **Step 6: Promote the PostgREST fake to a shared helper**

`tests/tenant-isolation/unit/repository.test.ts:38-61` defines `fakeDb` locally. The new read test needs it, and `RULES.md` §13 names `tests/helpers/` as the sanctioned shared-helper location, so move it rather than copy it.

Create `tests/helpers/fake-postgrest.ts` containing `fakeDb`, `EMPTY_PAGE` and the `Result` type, verbatim from those lines, with the existing doc comment intact, exported:

```ts
export type Result = { data: unknown; error: { message: string } | null };

export const EMPTY_PAGE: Result = { data: [], error: null };

/** Call sink. Exported because `vi.hoisted`'s factory runs before imports, so a
 *  helper module cannot close over a test file's own `boundary`. */
export const calls: string[] = [];

/** Chainable, awaitable fake for the PostgREST query builder: `from()` returns a
 *  chain where every link method records itself, and awaiting the chain consumes
 *  the next canned result. Only the chain is thenable — a thenable `db` root would
 *  be unwrapped by the `await` on `createServerSupabaseClient()`. */
export function fakeDb(label: string, results: Result[]) {
  /* … body moved verbatim from repository.test.ts:38-60, with every
     `boundary.calls.push(...)` becoming `calls.push(...)` … */
}
```
Copy the body character-for-character apart from that sink rename — `boundary` is a `vi.hoisted` local inside `repository.test.ts` and a separate module cannot close over it, which is why the helper owns the array. Consumers keep their own `afterEach` truncation, now `calls.length = 0`. Then in `repository.test.ts` delete the local `fakeDb`, `Result` and `EMPTY_PAGE` declarations and add:

```ts
import { calls, EMPTY_PAGE, fakeDb } from "../../helpers/fake-postgrest";
```

`Result` is not imported: once the local declarations are gone nothing in that file names the type, and `@typescript-eslint/no-unused-vars` would print a warning the task's own "lint silent" gate forbids. Every `boundary.calls` reference in both test files becomes `calls`.
(`tests/helpers/` is the one place a relative import is allowed.)

```bash
pnpm test repository
```
Expected: the existing 8 still pass. If any fails, the copy drifted — diff against git and fix the helper, not the assertions.

- [ ] **Step 7: Write the failing read test**

Create `tests/tenant-isolation/unit/connections-read.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  scoped: vi.fn(),
  admin: vi.fn(),
  calls: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.scoped,
}));
vi.mock("@/lib/db/admin", () => ({ getAdminDb: boundary.admin }));

import { listConnections } from "@/lib/db/repository";
import { EMPTY_PAGE, fakeDb } from "../../helpers/fake-postgrest";

const A = {
  id: "00000000-0000-4000-8000-00000000000a",
  name: "Atlas Coffee",
  domain: "atlas.example",
  is_active: true,
};
const CREDENTIALS = [
  {
    client_id: A.id,
    source: "semrush",
    created_at: "2026-09-12T00:00:00.000+00:00",
  },
];

afterEach(() => {
  boundary.scoped.mockReset();
  boundary.admin.mockReset();
  boundary.calls.length = 0;
});

describe("listConnections", () => {
  it("reads both relations as the signed-in user, never the admin client", async () => {
    // listAccessibleClients pages clients (one page + the short page that ends
    // the loop), then api_credentials is read — sequential on purpose so the
    // fake's canned results are consumed in a deterministic order.
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [
        { data: [A], error: null },
        EMPTY_PAGE,
        { data: CREDENTIALS, error: null },
      ]),
    );
    boundary.admin.mockReturnValue(fakeDb("admin", []));

    await expect(listConnections()).resolves.toEqual([
      {
        client: { id: A.id, name: A.name, domain: A.domain, initials: "AC" },
        sources: [{ source: "semrush", linkedAt: "2026-09-12T00:00:00.000+00:00" }],
      },
    ]);
    expect(boundary.admin).not.toHaveBeenCalled();
    expect(boundary.calls).toContain("scoped.from(api_credentials)");
  });

  it("selects the reference column never", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [
        { data: [A], error: null },
        EMPTY_PAGE,
        { data: CREDENTIALS, error: null },
      ]),
    );
    await listConnections();
    const select = boundary.calls.find((call) => call.endsWith("select(client_id,source,created_at)"));
    expect(select).toBeDefined();
    expect(boundary.calls.join(" ")).not.toContain("credential_reference");
  });

  it("returns nothing without spending a credential query", async () => {
    // An unprovisioned account has no tenants to look credentials up for; the
    // early return is the whole empty state, and it must stay the empty state.
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [EMPTY_PAGE]));
    await expect(listConnections()).resolves.toEqual([]);
    expect(boundary.calls.filter((c) => c.includes("api_credentials"))).toEqual([]);
  });

  it("rejects when RLS hides the table from the caller", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [
        { data: [A], error: null },
        EMPTY_PAGE,
        { data: null, error: { message: "permission denied for table api_credentials" } },
      ]),
    );
    await expect(listConnections()).rejects.toThrow("Database operation failed");
    // Without this the case cannot tell "RLS denied the caller" from "the fake
    // ran out of canned results": a wrong-client read reaches the unset
    // `boundary.admin`, and `databaseOperation`'s catch-all re-emits the same
    // message. This assertion is per-case and does not generalise —
    // `repository.test.ts`'s cron case asserts the opposite boundary on purpose.
    expect(boundary.admin).not.toHaveBeenCalled();
  });
});
```

The load-bearing assertion is `expect(boundary.admin).not.toHaveBeenCalled()`: it is the same "the gate never touches the service-role client" claim `repository.test.ts:83-84` makes, extended to the credential read. Metric reads stay on `getAdminDb()` deliberately, so nothing in this file may assert that the admin client is never used at all — only that *this* function does not use it.

- [ ] **Step 8: Run it to verify it fails**

```bash
pnpm test connections-read
```
Expected: FAIL — `listConnections` is not exported from `@/lib/db/repository`.

- [ ] **Step 9: Implement the read**

Append to `lib/db/repository.ts`. Schemas go beside the existing ones (after `keywordRankingRowSchema`, `:67`), the function after `canAccessClient`:

```ts
const credentialRowSchema = z.object({
  client_id: idSchema,
  source: sourceSchema,
  created_at: timestampSchema,
});
```
```ts
/**
 * Connection status per tenant. Both relations are read as the signed-in user,
 * so `api_credentials_select_tenant_or_admin` and `clients_select_authenticated`
 * decide the row set; the column list names the three readable columns, and a
 * credential reference never reaches this process, let alone a response.
 *
 * Deliberately NOT wrapped in `unstable_cache`: the client is cookie-bound, and
 * a cached function keyed on nothing while deriving its rows from the caller is
 * the cross-user leak the tenant-gate change closed
 * (context/architecture-context.md invariant 4-5).
 */
export async function listConnections(): Promise<ClientConnections[]> {
  const clients = await listAccessibleClients();
  if (clients.length === 0) return [];
  return databaseOperation(async () => {
    const db = await createServerSupabaseClient();
    const { data, error } = await db
      .from("api_credentials")
      .select("client_id,source,created_at");
    if (error) throw new Error("Database operation failed");
    const rows = z.array(credentialRowSchema).parse(data ?? []).map((row) => ({
      clientId: row.client_id,
      source: row.source,
      linkedAt: row.created_at,
    }));
    return buildConnectionStates(clients, rows);
  });
}
```
and add the two imports at the top of the file:

```ts
import { buildConnectionStates } from "@/lib/connections/status";
import type { ClientConnections } from "@/types/connections";
```

- [ ] **Step 10: Run the gate**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```
Expected: 146 + 5 (`connections-status`) + 4 (`connections-read`) = **155 passed / 25 files**. Run `pnpm test:integration` too: Task 4's four live cases must stay green, which is the point of asserting them at the PostgREST boundary rather than through this new helper. `pnpm build` must still report `/dashboard` as `○` — nothing here is reachable from a page yet, and if it flips, an import escaped into client code.

- [ ] **Step 11: Commit**

```bash
git add lib types tests
git commit -m "feat(connections): tenant-scoped credential status read"
```

---

### Task 6: The `/connections` page

A server component on a dynamic route: it awaits the session cookie through `listConnections()`, so `ƒ` is correct here — unlike `/dashboard`, which keeps its client-side boot fetch. The catalog of providers is a pure module so the "not supported yet" claim is testable copy rather than a vibe. Per the two scoping decisions: a supported source renders a `disabled` Connect whose `title` states why, and an upcoming provider renders no control at all — Global Constraints forbid a credential write, and a greyed button on a source with no key-paste flow is a fake affordance.

**Files:**
- Create: `components/features/connections/index.ts`
- Create: `components/features/connections/lib/catalog.ts`
- Create: `components/features/connections/components/connections-page.tsx`
- Create: `components/features/connections/components/connection-row.tsx`
- Create: `app/(app)/connections/page.tsx`
- Create: `tests/platform/unit/connections-catalog.test.ts` (not `tests/connections/` — Step 1)

**Interfaces:**
- Consumes: `listConnections()`, `ClientConnections`, `DashboardClient`, `Source`.
- Produces: route `/connections`; `SUPPORTED_SOURCES`, `UPCOMING_PROVIDERS`, `connectionStatusLabel(linkedAt: string | null): string`.

- [ ] **Step 1: Decide the catalog's test home before writing it**

`feature-components.md`: "A feature slug used as a test folder name must already exist there; if it does not, the feature owns no test folder yet and the test belongs under the domain that owns the invariant." `tests/connections/` does not exist. The catalog's invariant is *copy and coverage*, not tenancy — closest owner is `platform`. Create `tests/platform/unit/connections-catalog.test.ts`, and note the choice in the commit body so the next person does not read it as drift.

- [ ] **Step 2: Write the failing catalog test**

Create `tests/platform/unit/connections-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  SUPPORTED_SOURCES,
  UPCOMING_PROVIDERS,
  connectionStatusLabel,
} from "@/components/features/connections/lib/catalog";
import { SOURCES } from "@/types/metrics";

describe("connection catalog", () => {
  it("names every metric source exactly once", () => {
    expect(SUPPORTED_SOURCES.map((s) => s.source)).toEqual([...SOURCES]);
  });

  it("never advertises an upcoming provider as supported", () => {
    // The point of the split: `api_credentials` cannot store these sources, so a
    // card that implied otherwise would be the claim the landing page just
    // retracted (progress-tracker, 2026-09-24 copy pass).
    const supported = new Set<string>(SUPPORTED_SOURCES.map((s) => s.source));
    for (const upcoming of UPCOMING_PROVIDERS) {
      expect(supported.has(upcoming.id)).toBe(false);
    }
  });

  it("keeps every upcoming provider honest about why", () => {
    for (const provider of UPCOMING_PROVIDERS) {
      expect(provider.reason.length).toBeGreaterThan(20);
    }
  });

  it("labels a linked source by date and an unlinked one plainly", () => {
    expect(connectionStatusLabel("2026-09-12T00:00:00.000+00:00")).toMatch(/Linked/);
    expect(connectionStatusLabel(null)).toBe("Not connected");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
pnpm test connections-catalog
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the catalog**

Create `components/features/connections/lib/catalog.ts`:

```ts
import { SOURCES, type Source } from "@/types/metrics";

export interface SupportedSource {
  source: Source;
  label: string;
  detail: string;
}

/** The three sources `api_credentials_source_check` permits. Widening this is
 *  a migration plus a `SOURCES` change, never a catalog edit. */
export const SUPPORTED_SOURCES: readonly SupportedSource[] = SOURCES.map(
  (source) => ({
    source,
    label: source === "gsc" ? "Search Console" : source === "ga4" ? "Analytics (GA4)" : "Semrush",
    detail:
      source === "semrush"
        ? "Static API token, pasted by an account owner."
        : "OAuth grant from the property owner.",
  }),
);

export interface UpcomingProvider {
  id: "google-ads" | "meta-ads";
  label: string;
  reason: string;
}

/** Displayed as unavailable. Neither is in the credential enum, and Google and
 *  Meta are OAuth-only, so "paste your key" would be false for both. */
export const UPCOMING_PROVIDERS: readonly UpcomingProvider[] = [
  {
    id: "google-ads",
    label: "Google Ads",
    reason: "Needs an OAuth consent flow and a durable refresh-token grant.",
  },
  {
    id: "meta-ads",
    label: "Meta Ads",
    reason: "Needs an OAuth flow plus Meta app review and business verification.",
  },
];

const linkedDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function connectionStatusLabel(linkedAt: string | null): string {
  return linkedAt === null
    ? "Not connected"
    : `Linked ${linkedDate.format(new Date(linkedAt))}`;
}
```

- [ ] **Step 5: Run it to verify it passes**

```bash
pnpm test connections-catalog
```
Expected: 4 passed. `SUPPORTED_SOURCES.map(...) === SOURCES` is the assertion that fails the day someone adds a source to one list and not the other.

- [ ] **Step 6: The page components**

Create `components/features/connections/components/connections-page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SUPPORTED_SOURCES,
  UPCOMING_PROVIDERS,
  connectionStatusLabel,
} from "../lib/catalog";
import { ConnectionRow } from "./connection-row";
import type { ClientConnections } from "@/types/connections";

export function ConnectionsPage({ connections }: { connections: ClientConnections[] }) {
  return (
    <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight font-medium">
          Connections
        </h1>
        <p className="max-w-prose text-sm text-text-muted">
          Which data sources each reporting client has linked. Linking is recorded by
          your account team for now: fetching stays offline until a sync worker is
          hosted, so this page reports status and takes no credentials.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {connections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-text-muted">
              No reporting client is assigned to your account yet.
            </CardContent>
          </Card>
        ) : (
          connections.map((entry) => (
            <Card key={entry.client.id}>
              <CardHeader>
                <CardTitle className="text-base">{entry.client.name}</CardTitle>
                <p className="text-xs text-text-faint">{entry.client.domain}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {SUPPORTED_SOURCES.map((supported) => {
                  const match = entry.sources.find(
                    (source) => source.source === supported.source,
                  );
                  return (
                    <ConnectionRow
                      key={supported.source}
                      label={supported.label}
                      detail={supported.detail}
                      status={connectionStatusLabel(match?.linkedAt ?? null)}
                    />
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not available yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {UPCOMING_PROVIDERS.map((provider) => (
              <ConnectionRow
                key={provider.id}
                label={provider.label}
                detail={provider.reason}
                status="Coming soon"
                showConnectButton={false}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```

Create `components/features/connections/components/connection-row.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ConnectionRow({
  label,
  detail,
  status,
  showConnectButton = true,
}: {
  label: string;
  detail: string;
  status: string;
  showConnectButton?: boolean;
}) {
  const linked = status !== "Not connected" && status !== "Coming soon";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-muted">{detail}</span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={linked ? "default" : "secondary"}>{status}</Badge>
        {showConnectButton ? (
          <Button
            size="sm"
            variant="outline"
            disabled
            className="text-xs"
            title="Recording a connection needs a write path that does not exist yet"
          >
            Connect
          </Button>
        ) : null}
      </div>
    </div>
  );
}
```
No `disabled` prop: the button is disabled for every row because there is no write path, and a prop that cannot be set to `false` is a lie about the component's future. `showConnectButton={false}` is the other half of the decision — Google and Meta get a "Coming soon" badge and no button of any kind, since a greyed Connect on a source that has no key-paste flow is exactly the fake affordance this page was scoped to avoid. `Badge`'s `secondary` variant already exists (`components/ui/badge.tsx`), so nothing here touches `components/ui/*` (`RULES.md` §17). The `title` is the button's stated reason — a disabled control that explains nothing reads as a bug, and the agreed posture is status-only until a worker is hosted.

Create `components/features/connections/index.ts`:

```ts
export { ConnectionsPage } from "./components/connections-page";
```

- [ ] **Step 7: The route**

Create `app/(app)/connections/page.tsx`:

```tsx
import type { Metadata } from "next";

import { ConnectionsPage } from "@/components/features/connections";
import { listConnections } from "@/lib/db/repository";

export const metadata: Metadata = {
  title: "Connections — JK Intelligence",
};

/** Dynamic on purpose: it reads the session cookie through the RLS gate. Do not
 *  add `revalidate` or a cache wrapper — see architecture-context.md invariant 4-5. */
export default async function Page() {
  return <ConnectionsPage connections={await listConnections()} />;
}
```

- [ ] **Step 8: Verify in a browser, then in the build**

```bash
pnpm dev -p 3000
```
Sign in as the demo user and open `/connections`. Expected: the client cards name each source, and every supported row reads `Not connected` — Task 7's seed script is what creates `Linked <date>` rows, so if it has already been run on this database the seeded client's Semrush row reads `Linked <date>` instead. Either reading is correct here; what must not happen is an error boundary or an empty page for a signed-in user with clients. The Google/Meta card reads `Coming soon` with **no button beside it**, every button that does render is a greyed Connect, and the browser console is clean. Reload while signed in as a `client`-role account if one is provisioned — the foreign client card must be absent. Kill the server.

```bash
pnpm build
```
Expected: `/connections` → `ƒ`, `/dashboard` still `○`.

- [ ] **Step 9: Full gate, then commit**

```bash
pnpm test && pnpm typecheck && pnpm lint   # build ran in Step 8
git add components/features/connections "app/(app)/connections" tests/platform
git commit -m "feat(connections): read-only per-tenant connection status page"
```

---

### Task 7: Give the page rows to show

`api_credentials` has exactly zero rows in every environment — `scripts/seed.mjs` writes clients and metrics only, and nothing has ever inserted a credential. Without data, the page built in Task 6 renders all-"Not connected" and cannot be demoed. This is a separate, reversible script rather than an edit to `seed.mjs`, so the metrics seed's idempotency guarantees stay untouched (`RULES.md` §3).

**Files:**
- Create: `scripts/seed-connections.mjs`
- Modify: `package.json` (one script line), `.env.example` (comment only if it lacks `SUPABASE_DB_URL` — it does not)

**Interfaces:**
- Consumes: `SUPABASE_DB_URL` + `pg`, same as `scripts/run-migrations.mjs`; `clients.domain` as the upsert key that `seed.mjs` also uses.
- Produces: `pnpm db:seed-connections`, and rows the Task 6 page reads through RLS.

- [ ] **Step 1: Write the script**

Create `scripts/seed-connections.mjs`:

```js
import pg from "pg";

// Seeds demo api_credentials rows so /connections has something to render.
// Writes a syntactically valid, obviously fake Vault reference: nothing in this
// app decrypts or uses it, and the credential_reference check constraint is the
// only thing it must satisfy. Never prints the reference (RULES.md section 16).

const args = new Set(process.argv.slice(2));
const reset = args.has("--reset");
const dryRun = args.has("--dry-run");

const CLIENTS = [
  { domain: "northstar.example", sources: ["gsc", "ga4", "semrush"] },
  { domain: "evergreen.example", sources: ["gsc"] },
  { domain: "atlas.example", sources: [] },
];

const PLACEHOLDER_REF = "vault:00000000-0000-4000-8000-00000000d00d";

if (dryRun) {
  let planned = 0;
  for (const client of CLIENTS) planned += client.sources.length;
  console.log(`[seed-connections] dry run: ${planned} rows across ${CLIENTS.length} clients`);
  for (const client of CLIENTS) {
    console.log(`  ${client.domain}: ${client.sources.join(", ") || "(none)"}`);
  }
  process.exit(0);
}

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[seed-connections] SUPABASE_DB_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  if (reset) {
    const { rowCount } = await client.query(
      "delete from public.api_credentials where credential_reference = $1",
      [PLACEHOLDER_REF],
    );
    console.log(`[seed-connections] removed ${rowCount} placeholder row(s)`);
  }

  let inserted = 0;
  for (const spec of CLIENTS) {
    const found = await client.query(
      "select id from public.clients where domain = $1",
      [spec.domain],
    );
    if (found.rowCount === 0) {
      console.warn(`[seed-connections] no client for ${spec.domain} — run pnpm db:seed first`);
      continue;
    }
    for (const source of spec.sources) {
      const { rowCount } = await client.query(
        `insert into public.api_credentials (client_id, source, credential_reference)
         values ($1, $2, $3)
         on conflict (client_id, source) do nothing`,
        [found.rows[0].id, source, PLACEHOLDER_REF],
      );
      inserted += rowCount;
    }
  }
  console.log(`[seed-connections] inserted ${inserted} row(s)`);
} finally {
  await client.end();
}
```
`on conflict … do nothing` is what makes re-runs safe, matching `seed.mjs`'s idempotency; `--reset` deletes only placeholder rows, never a real reference, mirroring `seed.mjs --reset`'s "deletes only `run_id like 'seed-%'`" discipline.

- [ ] **Step 2: Register the command**

In `package.json`, beside `db:seed`:

```json
 "db:seed-connections": "node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/seed-connections.mjs",
```

- [ ] **Step 3: Prove the dry run needs no database**

```bash
pnpm db:seed-connections --dry-run
```
Expected: `[seed-connections] dry run: 4 rows across 3 clients`, then one line per domain, and **no printed reference**. (4, not 6: `CLIENTS` sums to 3 + 1 + 0. That split is the point — `northstar` exercises the all-linked card, `evergreen` the mixed one, and `atlas` with `sources: []` is the only card that renders `09-connections.md`'s "Client with no credentials: every row 'Not connected'". Adding sources to reach a rounder number would delete a documented state.)

- [ ] **Step 4: Apply and verify the join**

```bash
pnpm db:seed   # if clients are not yet seeded
pnpm db:seed-connections
pnpm test:integration
```
Expected: `inserted N row(s)` (first run `4`; a re-run `0`, which is the idempotency proof). Task 4's live RLS file must still report `4 passed` — the fixture seeds its own credential rows and does not read the ones this script writes, so a change here cannot break it, and that separation is why the fixture uses `clients.a`/`clients.b` while the script uses the demo domains. Then prove the delete path:

```bash
pnpm db:seed-connections --reset
```
Expected: `removed 4 placeholder row(s)` **immediately followed by `inserted 4 row(s)`** — `--reset` deletes and re-seeds in one run, matching `seed.mjs`, so the table total never drops and there is no delete-only mode. The proof is the `removed` line itself: the script opens no transaction, so that `rowCount` is a committed delete, and the two fixture-referenced rows must still be present afterwards (their reference literal differs from `PLACEHOLDER_REF`).

- [ ] **Step 5: Full gate, then commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
git add scripts/seed-connections.mjs package.json
git commit -m "feat(scripts): seed placeholder api_credentials rows for /connections"
```

---

### Task 8: Make the docs describe what now exists

Four documents currently claim things this change falsifies. `RULES.md` §14 makes fixing them part of the change, and `AGENTS.md`'s own editing rule is explicit: move newly built surface out of `docs/target-state.md` in the same change that builds it.

**Files:**
- Modify: `AGENTS.md` (HTTP table, test-ownership table, the `api_credentials` sentence under *Tenant isolation*, the *Pages and caching* route list)
- Modify: `docs/target-state.md:318` (step 3) and the status block at its head
- Modify: `context/architecture-context.md` (HTTP surface, Persistence Schema)
- Modify: `context/progress-tracker.md` (Current Phase, Completed entry, Open Questions 1)

- [ ] **Step 1: `AGENTS.md`**

In the HTTP surface table, add one row after `/api/exports/[clientId]/pdf`:

```md
| `/connections` (page) | GET | session + RLS | server page; reads `api_credentials` per tenant, no cache |
```
Correct the now-false sentence "`api_credentials` has a `using (false)` select policy and is never read by the app today." to name the replacement policy:

```md
`api_credentials` is readable through `api_credentials_select_tenant_or_admin`, which applies the
same two `security definer` helpers as `clients`; the app reads `client_id`, `source` and
`created_at` only, and never `credential_reference`.
```
In the *Pages and caching* section, move `/dashboard` and `/profile` into a note that they live under `app/(app)/` with a shared destination rail, and add `/connections`. In the test-ownership table, extend the `tenant-isolation` and `platform` rows rather than adding a folder:

```md
| `tenant-isolation` | `canAccessClient` / `listAccessibleClients`, `listConnections` + `lib/connections/status`, and the RLS policies behind all three |
| `platform` | cross-cutting primitives with no owning feature — `lib/rate-limit.ts`, `lib/navigation/destinations.ts`, the connections catalog |
```

- [ ] **Step 2: `docs/target-state.md`**

Step 3 (`:318`) currently reads `⚠️ API credentials model — … nothing resolves the reference`. It becomes:

```md
3. ⚠️ API credentials model — a tenant can now read its own `api_credentials` status rows
   (`20260925000000_connections_read.sql`), surfaced at `/connections`. Still unread:
   `credential_reference`, which nothing resolves because no sync worker is hosted (steps 4-8).
```
Add to the head status block that `api_credentials` is now read by the app, so the paragraph claiming otherwise stops being true, and leave steps 4-8, 12 and 13 unchecked — nothing here built them.

- [ ] **Step 3: `context/architecture-context.md`**

Add `/connections` to the HTTP surface as its only server-rendered read of tenant rows (`/profile` is cookie-scoped too but reads only the caller's own `users` row), and record the no-cache rule where invariant 4-5 lives, so the next reader knows it was applied deliberately rather than forgotten. In Persistence Schema, change the `api_credentials` line from "never read" to the column list the app reads.

- [ ] **Step 4: `context/progress-tracker.md`**

New `## Completed` entry recording: the route group, the registry + parity test, the rail, the policy swap, `listConnections`, `/connections`, the seed script. State the gate numbers actually printed, name the files the integration tier covers, and **quote the `pnpm test:integration` output line** so "written" is never mistaken for "run". Under Open Questions, append to item 1 that `/connections` now renders credential status but the worker-hosting decision (item 2) still gates every fetch, and that the Connect button is deliberately inert until it closes. Do not resurrect the landing page's retracted "Connect your client accounts" step — this change records links; it does not fetch with them.

- [ ] **Step 5: Verify no doc still contradicts the code**

```bash
grep -rn "never read\|using (false)\|no admin panel page" AGENTS.md docs/target-state.md context/architecture-context.md
```
Expected: no line that this change falsified remains. Anything left is either correct about a different table or a doc defect to fix now, not in a follow-up.

- [ ] **Step 6: Final gate and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm test:all && pnpm test:e2e
```
Expected: unit **159 passed / 26 files** (139 baseline + 7 in Task 2 + 9 in Task 5 + 4 in Task 6 — take the real number from the run, not from this line); `/dashboard` `○`, `/connections` `ƒ`; public e2e 7 passed (6 + `connections-guard`; `rail.spec.ts` is `@auth` so it does not join the public tier); authed e2e green locally.

```bash
git add AGENTS.md docs context
git commit -m "docs: describe the app shell and the read-only connections surface"
```

---

## Appendix A — `context/feature-specs/08-app-shell.md` body

```md
# App Shell and Destination Rail

## Goal
One persistent chrome around every authenticated page: a left destination rail at `lg+`,
a horizontal strip below, so `/dashboard`, `/connections` and future pages share identity
and navigation instead of each re-declaring a header.

## Invariants
- The shell is a server component and reads no session, no cookies, no data. `/dashboard`
  must stay prerendered (`○`); a session read in the shell re-introduces the 4-5s Vercel
  switch the client-side boot fetch was built to fix.
- `lib/navigation/destinations.ts` is the only rail list. Every href it renders must be in
  `PROTECTED_PREFIXES`; `tests/platform/unit/destinations.test.ts` asserts the parity, so a
  destination cannot be advertised before it is guarded.
- Route group `app/(app)/` never appears in a URL. `/dashboard`, `/profile`, `/connections`
  keep their paths.

## Non-goals
- Collapsing/expanding. `ui-context.md` listed "(collapsible)"; dropped, because a
  collapsed-by-default rail makes every destination one click from undiscoverable.
- Role-gated destinations. With no `/admin` route there is no difference to render, and a
  `visibleDestinations(role)` filter would be an abstraction with one hypothetical caller.
  The admin panel adds its row and the filter together.
- Moving the client selector or `AccountMenu` into the shell. Both need the session; the
  selector is dashboard scope today.
- Any change to `?client` / `?days` / `?tab=` URL state or the `<Activity>` tab panels.

## Accepted limitations
- Two nav landmarks share the name "Sections" (rail + strip). They are `lg:hidden` /
  `hidden lg:flex`, so exactly one is in the accessibility tree at any width; e2e takes
  `.first()` rather than asserting one exists.
- Below `lg` the brand mark is not repeated in the strip; the footer and the login redirect
  carry it.

## Verification
`pnpm build` route table (`/dashboard` `○`), `tests/platform/unit/destinations.test.ts`,
`tests/identity/e2e/connections-guard.spec.ts`, `tests/dashboard/e2e/rail.spec.ts`
(`@auth`, incl. no page overflow at 320/390/414).
```

## Appendix B — `context/feature-specs/09-connections.md` body

```md
# Connections (read-only)

## Goal
Per reporting client, show which data sources are linked — and say plainly which providers
cannot be connected yet and why.

## What this is not
- No credential writes. No insert/update/delete policy exists on `api_credentials` for any
  role but `service_role`, and the Connect control is rendered `disabled` with its reason in
  the copy. Rationale: nothing consumes the sync queue (`worker.ts` -> `mock_completed`,
  Open Question 2), so a stored Google/Meta token would be a live credential with no reader.
- No new sources. `google_ads` / `meta_ads` are display catalog entries only; adding a value
  to `api_credentials_source_check` or `SOURCES` touches `persist_metrics` and every metrics
  read, and belongs to the sync work.
- No OAuth. Google and Meta are OAuth-only, so "paste your key" would be false for both;
  the static-token case that exists today is Semrush.

## Data and tenancy
- One migration: `api_credentials` loses `using (false)`, gains
  `api_credentials_select_tenant_or_admin` — the same `private.current_user_role()` /
  `current_user_client_id()` predicate as `clients_select_authenticated`. No TypeScript
  helper re-derives ownership (`RULES.md` section 15).
- `listConnections()` reads `clients` then `api_credentials`, both through the cookie-bound
  client, and selects `client_id, source, created_at`. It is never wrapped in
  `unstable_cache`: a cookie-bound client inside a function keyed on nothing is the
  cross-user leak the tenant-gate change closed (invariant 4-5).
- `/connections` is dynamic (`ƒ`) by design. It awaits the session cookie.

## Accepted limitations
- The select policy is row-level, so `credential_reference` is selectable by a tenant that
  can see the row. Tolerated because the column holds an opaque Vault *reference* rather than
  a secret, nothing in the app decrypts it, and no response, log or cache entry carries it.
  Column-level protection is the follow-up if a real reference is ever written.
- `api_credentials` records that a link exists and when. It carries no health, scope or
  expiry, so "Linked" means linked, not working.

## Empty and error states
- No visible client: one card, "No reporting client is assigned to your account yet."
- Client with no credentials: every row "Not connected".
- Database unreachable: the read throws "Database operation failed"; the page is a server
  component with no try/catch, so Next's error boundary renders it. Deliberate: inventing a
  per-page error shell here would be a second error surface.

## Verification
`tests/tenant-isolation/unit/connections-status.test.ts`,
`tests/tenant-isolation/unit/connections-read.test.ts` (incl. "never the admin client",
"never selects the reference"), `tests/platform/unit/connections-catalog.test.ts`,
`tests/tenant-isolation/integration/credentials-visibility.test.ts` (live RLS, `skipIf` —
written, and labelled as not yet executed).
```

## Appendix C — test file routing

Seven new test files and one modified, zero new folders, per `feature-components.md` ("if the feature owns no test
folder yet, the test belongs under the domain that owns the invariant"):

| file | tier | why this folder |
| --- | --- | --- |
| `tests/platform/unit/destinations.test.ts` | unit | `lib/navigation/*` is a cross-cutting primitive with no owning feature — the `platform` slot `lib/rate-limit.ts` already occupies |
| `tests/identity/unit/routing.test.ts` | unit (modified) | `identity` owns `lib/auth/routing` per `AGENTS.md` |
| `tests/identity/e2e/connections-guard.spec.ts` | e2e public | guards `PROTECTED_PREFIXES`, which `identity` owns. Note `tests/dashboard/e2e/guard.spec.ts` predates that rule; relocating it is out of scope here (as the admin spec concluded) |
| `tests/tenant-isolation/unit/connections-status.test.ts` | unit | the invariant is "one tenant's rows never render under another" |
| `tests/tenant-isolation/unit/connections-read.test.ts` | unit | asserts the read never uses `getAdminDb()`, matching `repository.test.ts` |
| `tests/tenant-isolation/integration/credentials-visibility.test.ts` | integration | live RLS, `skipIf(!hasTestDb)`, second slice after `rls-gate.test.ts`. Queries PostgREST directly instead of `lib/db/repository`, so it keeps proving the policy even if the read path later moves to the service-role client |
| `tests/platform/unit/connections-catalog.test.ts` | unit | copy/coverage invariant, no owning feature |
| `tests/dashboard/e2e/rail.spec.ts` | e2e `@auth` | `dashboard` owns the `/dashboard` render the rail wraps |
