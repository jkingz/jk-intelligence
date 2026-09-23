# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component or route.
- Respect the system boundaries in `architecture-context.md`; a helper belongs in the layer that owns the data.
- One agent per file, and one file per concern — `lib/agents/authAgent.ts` is the template. Agents other than `authAgent` do not exist yet; when added they follow `docs/target-state.md`.
- Import within the app with the `@/` alias (`@/lib/db/repository`), never `../../..` climbing.
- Any module reading env secrets or the service-role client starts with `import "server-only"`.

## TypeScript

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

## Next.js

- Default to React Server Components.
- Add `"use client"` only for interactive UI: charts, date pickers, real-time stale banners, and auth forms.
- Route handlers do one thing: validate → authenticate → tenant-gate → read/delegate to `lib/*`.
  Never inline a query, and never re-implement the ownership rule (see invariant 4).
- Never run sync jobs inline in route handlers — always queue via BullMQ.
- Long-running work belongs in BullMQ jobs, not request handlers.
- Load heavy first-party chart libraries (recharts) via `next/dynamic` behind the nearest `<Suspense>`, and keep the Suspense fallback in its **own recharts-free module**. Never co-locate the fallback with the chart import — co-location defeats the split by pulling the chart barrel back into the initial route JS.
- Tree-shake first-party icon/chart barrel packages (`lucide-react`, `recharts`) via `experimental.optimizePackageImports` so the dashboard entry only ships the pieces the route actually uses.

## React 19.3 Rendering

- Opt a component out of SSR with `use(browser())` (`react-dom`) and wrap it in the nearest `<Suspense>` with a layout-matched fallback. Never hand-roll a `mounted` flag or `typeof window` check — `browser()` is the first-class API for this.
- Keep expensive offscreen subtrees mounted with `<Activity mode={open ? "visible" : "hidden"}>` so their state survives, instead of remounting. Do not use it to hide content that must re-initialize on show.
- Animate navigational changes with `<ViewTransition>` paired with `addTransitionType` so direction-aware enter/exit is possible. The state update must run inside `startTransition`, otherwise no animation is captured.
- `<Activity>` inside `<ViewTransition>` animates enter/exit on visibility changes while preserving state — this is the sanctioned pattern for tabbed/conditional panels.
- Define view-transition animations as CSS classes in `globals.css`, and disable all `::view-transition-*` animations under `prefers-reduced-motion: reduce`.
- Group wrapper-free DOM nodes with a Fragment Ref (`useRef<FragmentInstance>` + `<Fragment ref>`), not an extra `<div>`. `InView` (`components/ui/in-view.tsx`) uses this to observe its first-level children with one `IntersectionObserver` via `observeUsing` / `unobserveUsing`. Prefer it over `motion`'s `whileInView` for reveal-on-scroll; keep `motion` for scroll-linked values (`useScroll` / `useTransform`).
- Extract non-reactive callbacks out of effects with `useEffectEvent` instead of adding them to the dependency array. `InView` uses it so an inline `onChange` does not re-subscribe the observer.
- `next-themes@0.4.6` is patched via `pnpm.patchedDependencies` (`patches/next-themes@0.4.6.patch`) so its FOUC-prevention `<script>` is not re-rendered on the client. React 19 warns "Encountered a script tag while rendering React component" for the unpatched build. The patch early-returns `null` when `window` is defined; the script still ships in SSR HTML and runs before hydration. To change: re-run `pnpm patch next-themes@0.4.6` + `pnpm patch-commit`, never edit `node_modules` directly.

## Security Headers

- `next.config.ts` owns the `Content-Security-Policy` (non-nonce) and applies it to every route; keep `proxy.ts` auth-only.
- Trusted Types are **not** enforced via `require-trusted-types-for` — the Next.js client router re-creates head `<script>`/`<link>` elements on route transitions and React DOM parses scripts through an HTML sink (`div.innerHTML = "<script></script>"`), so enforcing the directive blocks client-side navigation in production ("This document requires 'TrustedHTML'/'TrustedScriptURL' assignment"). Production and dev send only `trusted-types nextjs` on the enforced policy (defense in depth against injected `createPolicy` calls); dev additionally carries `require-trusted-types-for 'script'` on `Content-Security-Policy-Report-Only` for observability.
- `trusted-types` must list `nextjs` — the policy Next.js creates in `next/dist/client/trusted-types.js`.
- `connect-src` is dev-wide (`ws: wss: https:`) and production-scoped (`https://*.supabase.co wss://*.supabase.co`). Any new external origin (APIs, fonts, images) must be added to the matching directive in `next.config.ts`.

## Images

- Use `next/image` (`Image`) for every image project-wide. Never use a raw `<img>` element — the `@next/next/no-img-element` lint rule enforces this.
- For known-SVG sources, `next/image` automatically sets `unoptimized` (vector, lossless); this repo allows SVGs via `images.dangerouslyAllowSVG` in `next.config.ts`, paired with `contentDispositionType: "inline"` and a CSP that blocks embedded scripts (`default-src 'self'; script-src 'none'; sandbox;`). Only point this at self-authored, script-free SVGs (e.g. Archify exports).
- Always pass explicit `width`/`height` (the asset's natural dimensions) so Next can reserve layout space; pair with `sizes` or responsive classes (`h-auto w-full`) for fluid scaling.
- New external image origins must be added to `images.remotePatterns` in `next.config.ts` AND to `img-src` in the CSP.

## Styling

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
- Border radius scale: `rounded-xl` small elements, `rounded-2xl` cards (metric cards always),
  `rounded-3xl` modals.

## API Routes

- Parse the `{clientId}` path param with `z.uuid()` **before** anything else; a malformed id is 400,
  not 403 — never echo whether the id exists for an unauthenticated caller.
- Order and status codes: 400 malformed input → 401 unauthenticated → 403 not this caller's client
  → 429 quota spent (exports, with `Retry-After`) → 503 database failure. There is no 500 path and no
  404 for another tenant's row.
- Only pure request validation (parsing the path id and the query) may run before the handler's
  `try`. Everything that awaits Supabase — the identity read (`getAuthUser()` / `getProfileView()`)
  and the tenant gate — runs **inside** it, so an outage or missing env config yields the JSON 503
  rather than an unhandled throw. A rejected read is a 503, not a 401: never turn infrastructure
  failure into "you are logged out".
- Bodies: failures are always `{ error: string }` with a fixed, non-reflective message — echoing the
  request or a DB error into the body is a leak. Successes use **two** shapes today, so match the
  route you are extending rather than inventing a third: `/keywords` returns the `{ data, meta }`
  envelope, while `/dashboard/boot` and `/overview` return the composite resource directly
  (`{ profile, clients, selection }`, `{ overview, history }`). Unifying them is an open item, not a
  change to make while doing something else.
- Every authenticated response sends `Cache-Control: no-store` (or an explicit short `s-maxage`)
  plus `Vary: Cookie`, so a shared cache can't serve one tenant to another.
- Keep handlers thin — push complexity into `lib/db`, `lib/dashboard`, `lib/exports`, `lib/queue`.
- Never return raw API credentials in any response.

```ts
// ✅ real handler shape from app/api/metrics/[clientId]/overview/route.ts
//    (Next 16 fork: ctx is typed and awaited; there is no json()/unauthorized() helper)
const { clientId: rawClientId } = await ctx.params;
const clientId = clientIdSchema.safeParse(rawClientId);
if (!clientId.success) {
  return new Response(JSON.stringify({ error: "Invalid client id" }), { status: 400, headers: NO_STORE });
}

try {
  const user = await getAuthUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 401, headers: NO_STORE });
  }

  const clients = await listAccessibleClients();
  const client = clients.find((c) => c.id === clientId.data) ?? null;
  if (!client) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: NO_STORE });
  }

  // …reads → 200
} catch {
  // identity read, tenant gate and reads share this one failure path
  return new Response(JSON.stringify({ error: "Database operation failed" }), { status: 503, headers: NO_STORE });
}
```
`NO_STORE` above is `{ "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Cookie" }`,
written inline per route. `getAuthUser()` takes no request argument — it reads the session from the
cookie store; routes needing identity + role in one round trip use `getAuthSession()`.

## Data & Storage

- All metric data in Supabase Postgres — no external blob storage.
- metrics_snapshots is append-only — never update or delete historical rows. `keyword_rankings`
  cascades from it, so a delete silently destroys keyword history too.
- current_metrics is the only mutable cache layer — one row per `(client_id, source)`.
- `api_credentials` holds a `vault:<uuid>` **reference**, never key material, and RLS denies direct
  select. Nothing in `.env`, logs, or responses may carry a provider key.
- Never expose the service-role key to client components or `NEXT_PUBLIC_*` vars. It is read only
  in `lib/db/admin.ts`, which is `server-only`.
- RLS enabled on every table — policies must match the role model (admin/client/staff), with
  role/client resolved by `security definer` helpers rather than parsed JWT claims.
- is_stale is computed server-side and stored — client reads the flag, never computes it.
- A new table ships with its policies in the same migration. "Table exists, RLS later" is a
  tenant-isolation bug, not a TODO.

## Standards for new agents

`lib/agents/` currently holds `authAgent` only. These rules apply to the sync/transform/cache/insights
agents when they are built to the contracts in `docs/target-state.md`.

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

## Error Handling

- Route handlers catch every awaited Supabase failure — identity read, tenant gate, read — and
  return 503; a thrown error in a handler becomes an HTML error page that the client `fetch` cannot
  parse.
- The dashboard has no cached-data fallback yet: a failed boot shows `"Failed to load dashboard
  data"` (`app/dashboard/dashboard-view.tsx`). Do not claim offline resilience until it exists.
- Sync failures (when built) write `sync_logs` → mark `is_stale` → alert admin. Agents never throw
  to a client.
- API errors logged with: clientId, source, timestamp, sanitized message. **No credentials, no
  tokens, no `console.log` of request headers.**
- Client-facing form/action status is a single bottom-right toast lifecycle (`@/lib/toast-status`): `startStatusToast` for processing → `finishStatusToast` flips to success/error. Do not build inline status banners — processing, success, and error all render in the toaster viewport.
- Interactive submit paths guard against duplicate submissions with a `SlidingWindowLimiter` (`lib/rate-limit.ts`) *and* the component's `pending`/`disabled` state — never rely on button disabling alone.

## File Organization

```
lib/
  agents/       — authAgent (identity + role). Other agents: not built
  auth/         — cron secret check, proxy routing decisions, safe `next`
  cache/        — tag ownership (`invalidate.ts`), worker→app ping (`notify.ts`)
  dashboard/    — read models shared by the boot and metrics routes
  db/           — repository (reads, tenant gate, writes) + `admin.ts` service-role client
  exports/      — dataset builder, CSV, PDF + `fonts/`, quota, filename
  queue/        — BullMQ queue definition + worker entrypoint
  rate-limit.ts — `SlidingWindowLimiter`
  supabase/     — client construction (protected)
components/
  ui/           — shadcn primitives (protected, do not hand-edit)
  features/     — dashboard, data-export, email-password-auth, landing, user-profile
app/
  api/          — thin route handlers (7 today; see architecture-context.md)
  dashboard/    — static shell + client-side boot fetch
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
  the subject through `@/` — a relative `./` specifier cannot survive the move.

## Testing

Vitest, Node environment, split into `unit` and `integration` projects. `pnpm test` runs the unit
project (19 files / 122 tests); `pnpm test lib/db` narrows by path — `pnpm test -- lib/db` does not,
it silently runs the whole tier. `pnpm test:all` adds integration, `pnpm test:e2e` is Playwright.

- New behavior gets a test in the same change; a bugfix gets a test that fails without the fix.
- Mock the **module boundary** with `vi.mock("@/lib/db/repository", …)`, never an internal function
  or a real network/DB call. Use `vi.hoisted(() => ({ fn: vi.fn() }))` so the mock factory can close
  over the spies, and `afterEach(() => vi.resetAllMocks())`.
- `vitest.config.ts` aliases `server-only` to its empty module and sets `conditions: ["react-server"]`,
  so a test never needs its own `vi.mock("server-only")` — the few that carry one are dead weight;
  drop it when you touch that file.
- Route tests assert the things that matter: 400 on malformed id, 401 with no session, **403 with no
  body data** for the other tenant's id, and 503 rather than a throw when the identity read, the
  tenant gate, or the read itself rejects.
- Tenant isolation is the highest-value test in the repo: two client fixtures (A and B), and every
  assertion checks that B's data never appears in A's response.
- `@/tests/sync/unit/flow.test.ts` covers cron → queue handoff;
  `tests/tenant-isolation/unit/repository.test.ts` covers the RLS gate contract. Change either and
  those tests must change with it.
- e2e lives in `tests/<feature>/e2e/*.spec.ts` and is Playwright: a `public` project that runs in CI
  against placeholder env, and an `@auth` project that runs only locally. Component-render tests remain
  deliberately absent — adding a testing-library dependency is a decision to raise, not one to make
  silently (see `docs/superpowers/specs/2026-09-23-test-suite-architecture-design.md` §2).