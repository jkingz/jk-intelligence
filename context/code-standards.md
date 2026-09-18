# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component or route.
- Respect system boundaries defined in `architecture-context.md`.
- Every agent (sync, transform, cache, auth) lives in its own file.

## TypeScript

- Strict mode required throughout.
- No `any` — use explicit interfaces or narrowly scoped types.
- Validate all external API responses at boundary before storing (use Zod).
- Use `interface` for object contracts, `type` for unions/aliases.

```ts
// ✅
interface MetricSnapshot {
  clientId: string
  date: string
  platform: Platform
  metricType: MetricType
  value: number
  metadata?: Record<string, unknown>
}

// ❌
const data: any = await fetchGSC()
```

## Next.js

- Default to React Server Components.
- Add `"use client"` only for interactive UI: charts, date pickers, real-time stale banners, and auth forms.
- Route handlers handle one responsibility: auth → validate → delegate to lib.
- Never run sync jobs inline in route handlers — always queue via BullMQ.
- Long-running work belongs in BullMQ jobs, not request handlers.

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

- Use CSS custom property tokens defined in `globals.css` — no raw Tailwind color classes like `zinc-*` or hardcoded hex values.
- Reference tokens through Tailwind utility names: `bg-base`, `text-copy-primary`, `border-surface-border`, `text-brand`.
- Border radius scale: `rounded-xl` small elements, `rounded-2xl` cards, `rounded-3xl` modals.
- Dashboard metric cards always use `rounded-2xl`.
- Stale-data banner uses warning token — never hardcoded yellow.

## API Routes

- Validate and parse request input (Zod) before any logic runs.
- Enforce auth + client ownership checks before any mutation.
- Return consistent response shapes: `{ data, error, meta }`.
- Keep handlers thin — push complexity into `lib/db`, `lib/agents`, `lib/queue`.
- Never return raw API credentials in any response.

```ts
// ✅ thin handler pattern
export async function GET(req: Request, { params }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const metrics = await getClientMetrics(params.clientId, user)
  return json({ data: metrics })
}
```

## Data & Storage

- All metric data in Supabase Postgres — no external blob storage.
- metrics_snapshots is append-only — never update or delete historical rows.
- current_metrics is the only mutable cache layer — updated after each sync.
- API credentials stored in Supabase Vault only — never in .env, logs, or API responses.
- Never expose service-role key to client components or `NEXT_PUBLIC_*` vars.
- RLS enabled on every table — policies must match role model (admin/client/staff).
- is_stale computed server-side and stored — client reads flag, never computes it.

## Agent Standards

- Each agent is a pure function where possible (input → output, no side effects).
- Sync agent uses Promise.allSettled — never let one API failure block others.
- Transform agent validates schema with Zod before writing to DB.
- Cache agent reads/writes Redis only — no direct DB calls.
- Circuit breaker state stored in Redis — not in memory (survives restarts).

```ts
// ✅ partial failure safe
const [gsc, ga4, semrush] = await Promise.allSettled([
  syncGSC(creds.gsc),
  syncGA4(creds.ga4),
  syncSemrush(creds.semrush),
])
// handle each result independently
```

## Error Handling

- Every agent wraps in try/catch — log to sync_logs, never throw to client.
- Sync failures → write failed status to sync_logs → mark is_stale → alert admin.
- Dashboard never shows 500 — always falls back to cached data + stale banner.
- API errors logged with: clientId, platform, timestamp, error message (no credentials).

## File Organization

```
lib/
  agents/       — syncAgent, transformAgent, cacheAgent, authAgent
  db/           — metrics, clients, credentials, syncLogs persistence
  queue/        — BullMQ job definitions, circuit breaker
  supabase/     — client construction, vault access
components/     — UI only, no business logic
app/
  api/          — thin route handlers (auth, metrics, sync trigger, cron)
  dashboard/    — server components, client charts
types/          — shared interfaces (MetricSnapshot, Client, SyncLog, etc.)
supabase/
  migrations/   — versioned schema, RLS policies, indexes
```

- Name files after responsibility, not technology.
- No business logic in `components/`.
- No DB calls in `app/api/` — delegate to `lib/db`.
- No sync logic in route handlers — delegate to `lib/queue`.