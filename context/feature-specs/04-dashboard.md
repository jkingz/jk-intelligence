# 04 — Dashboard Feature Migration

## Goal
Gradually apply feature-folder conventions without changing dashboard behavior.

## First Increment
- Move eight dashboard components to `components/features/dashboard/components/`.
- Move `dashboard-data.ts` to `components/features/dashboard/lib/` and update internal imports.
- Export only `Dashboard` through `components/features/dashboard/index.ts`.
- Wire `app/page.tsx` through the feature barrel.
- Preserve current UI, mock data, interactions, and client boundaries.

## Deferred
Hook extraction, mock-data ownership changes, additional tests, and live-data integration are separate increments.

## Chart Backdrop + Motion Increment
- ~~Add a layered secondary backdrop behind the chart card: a `bg-secondary` panel that peeks below/beside the card plus a faint `accent-primary/10` glow — both decorative (`aria-hidden`, `pointer-events-none`).~~ **Removed as annoying (2026-09-18): the decorative backdrop layers were deleted from `dashboard-chart.tsx`** (the offset `bg-secondary` panel and the blurred accent glow, along with their `useScroll`/`useTransform` parallax hooks).
- The remaining chart motion is a single scroll reveal on the chart card, gated by `useReducedMotion`.
- Respect `prefers-reduced-motion` via `useReducedMotion` — no transforms/reveal when reduced.
- Scope: chart component only. No animations added to other dashboard sections.

## React 19.3 Upgrade Increment
- Upgrade `react` / `react-dom` / `@types/*` to 19.3.0.
- Replace the manual SSR-mounted gate in the chart with `use(browser())` (`react-dom`) + a `<Suspense>` fallback (`DashboardChartFallback`); extract the header theme toggle into a `ThemeToggle` component that also uses `use(browser())`.
- Dashboard tabs: keep panels mounted with Base UI `keepMounted` and hide them with `<Activity mode>`, so panel state (query filter) survives switches and hidden panels are inert.
- Animate tab changes with `<ViewTransition>` + `addTransitionType("forward" | "backward")`, triggered inside `startTransition`; direction classes defined in `globals.css`; disabled under reduced motion.
- Scope: `dashboard.tsx`, `dashboard-chart.tsx`, new `theme-toggle.tsx`, `dashboard-header.tsx`, `globals.css`.

## Fragment-Ref InView Increment
- Add a headless `components/ui/in-view.tsx` primitive on React 19.3 Fragment Refs: `<Fragment ref={useRef<FragmentInstance>}>` observes its first-level children with one `IntersectionObserver` via `observeUsing` / `unobserveUsing`; props `once`, `threshold`, `rootMargin`, `onChange`; `onChange` wrapped in `useEffectEvent`.
- Replace the chart card's `motion` `whileInView` reveal with `<InView once>` + a CSS transition (`opacity` / `translate-y`, `motion-reduce:transition-none`); keep `motion`'s `useScroll` / `useTransform` parallax. No `whileInView` remains.
- Scope: new `components/ui/in-view.tsx` (barrel-exported), `dashboard-chart.tsx`.

## Trusted Types CSP Increment
- Own the `Content-Security-Policy` in `next.config.ts` for every route (non-nonce, per the Next.js CSP guide); `proxy.ts` stays auth-only.
- Do **not** enforce `require-trusted-types-for` — Next's client router re-creates head `<script>`/`<link>` elements on route transitions and React DOM parses `<script>` through an HTML sink, so enforcement produces "This document requires 'TrustedHTML' assignment. The action has been blocked" and breaks client-side navigation (reproduced in production build: navigating login → sign-up). Send `trusted-types nextjs` on the enforced production CSP and keep `require-trusted-types-for 'script'` on `Content-Security-Policy-Report-Only` in development only.
- `connect-src`: dev-wide (`ws: wss: https:`), production-scoped (`https://*.supabase.co wss://*.supabase.co`).
- Scope: `next.config.ts` only. No application code creates a policy — Next's built-in `nextjs` policy covers it.

## Repository-Backed Overview Increment
Replace in-memory mock data with reads from Supabase. `lib/mock-dashboard.ts` and `components/features/dashboard/lib/dashboard-data.ts` are deleted; the dashboard renders only persisted rows.

**Status: implemented** (33 tests, typecheck, lint, build pass; Supabase query path not exercised — no reachable project).

- **Shared types** (`types/dashboard.ts`): `DashboardClient`, `TrafficPoint`, `KeywordRow`, `AICitation`, `BriefItem`, `DashboardOverview`, `DASHBOARD_RANGES` (`7 | 30 | 90`). Components import these — no type inference from mock functions.
- **Pure builder** (`lib/dashboard/overview.ts`): `buildOverview({ client, days, snapshots, stale, now })` transforms `metrics_snapshots` rows into a `DashboardOverview`. `gsc` is the traffic/keyword source. Per-day totals are summed from keyword rows; the previous period is the same window shifted `days` earlier. Rank change compares the window's latest snapshot to its earliest. Returns `null` when there are no snapshots.
- **Repository** (`lib/db/repository.ts`): `listMetricSnapshots(clientId, source, from, to)`, `listAccessibleClients(profile)` (admin → all active; client → own `clientId` only; unprovisioned → none), and `getDashboardOverview(client, days, now)`.
- **`NormalizedMetric`** gains `searchVolume: number | null` (validated in the repository Zod schema and emitted by `scripts/seed.mjs`). No migration — it rides in the existing `metrics` JSONB; `persist_metrics` ignores it.
- **Page** (`app/page.tsx`): a server component that resolves the session, scopes clients to the user, reads `?client=&days=` `searchParams`, and passes `DashboardClient`, `clients`, `days`, and `DashboardOverview | null` into `Dashboard`. Client/range changes are URL navigations (`router.replace` inside `startTransition`), not client state.
- **Loading**: `Page` renders `<Suspense fallback={<DashboardSkeleton />}>` around an async `DashboardData` child (which awaits `searchParams`), so a navigation streams the `DashboardSkeleton` shell first and swaps in the resolved dashboard. The skeleton mirrors the header/hero/metric-card/chart/table layout to minimize layout shift; it is scoped to this route (not `app/loading.tsx`, which would leak into `/profile`).
- **Caching**: `getCachedDashboardOverview(client, days)` wraps `getDashboardOverview` in `unstable_cache` (keyed by client + range, `revalidate: 300`, tag `dashboard-overview`; this project does not enable `cacheComponents`, so `use cache` is unavailable). Revisiting a client/range is served from the Next data cache with no DB round-trip. Invalidate with `revalidateTag("dashboard-overview")` after a sync writes snapshots (sync currently enqueues via `/api/cron/sync`, so the tag is not yet wired). The cache is not access-controlled: only clients from the session-scoped `listAccessibleClients` may be passed in, and the key includes the client id.
- **Honest gaps**: AI citation data has no storage or source. `aiCitations` is always `[]`, `aiReferrals`/`previousAiReferrals` are `0`, and `aiGrowth` is `null` until a source + schema exist. The AI metric card, chart series, and AI Citation tab render explicit "not available" states instead of fabricated numbers. Keyword `searchVolume` renders `—` when absent.
- Scope: `types/dashboard.ts`, `lib/dashboard/overview.ts`, `lib/db/repository.ts`, `types/metrics.ts`, `scripts/seed.mjs`, `app/page.tsx`, `components/features/dashboard/**` (incl. `dashboard-skeleton.tsx`); deletes `lib/mock-dashboard.ts` and `components/features/dashboard/lib/dashboard-data.ts`.

## Security
- Auth, route protection, and RLS unchanged. The dashboard reads through the service-role client but the page scopes clients by the session's role/`client_id` before reading metrics, so a client user can never request another tenant's overview.
- Protected UI primitives untouched.

## Verification
Run `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. Confirm no `mock-dashboard` / `dashboard-data` imports remain. Pure `buildOverview` is unit tested; the Supabase query path is not exercised (no reachable project).
