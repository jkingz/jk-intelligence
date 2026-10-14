# Code Standards

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
  api/          — `guard.ts`: the response shape and the session/admin/tenant gates shared by the session-gated route files (the bearer routes build their own bodies; § HTTP surface carries the split)
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
  api/          — thin route handlers behind `lib/api/guard.ts` (see § HTTP surface for the file total and the session-gated/bearer split)
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

