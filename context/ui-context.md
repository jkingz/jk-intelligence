# UI Context

## Theme

Dark/light mode supported. Default: dark. Toggle via `data-theme` attribute on `<html>`. Visual language: deep charcoal surfaces, fire-red accent, paper text, clean data-dense reporting UI. Palette adapted from structurewebworks.com.

All colors defined as CSS custom properties in `globals.css`, mapped to Tailwind via `@theme inline`. Components use tokens only — no hardcoded hex or raw Tailwind color classes like `zinc-*` or `slate-*`.

### Dark Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#0d0d0d` |
| Surface | `--bg-surface` | `#141414` |
| Elevated surface | `--bg-elevated` | `#1a1a1a` |
| Subtle surface | `--bg-subtle` | `#212121` |
| Default border | `--border-default` | `#2b2b2b` |
| Subtle border | `--border-subtle` | `#3d3d3d` |
| Primary text | `--text-primary` | `#fafafa` |
| Secondary text | `--text-secondary` | `#d0d0d0` |
| Muted text | `--text-muted` | `#b0b0b0` |
| Faint text | `--text-faint` | `#8a8a8a` |
| Brand accent (fire red) | `--accent-primary` | `#ff3b30` |
| Brand hover | `--accent-hover` | `#ff5f52` |
| Brand dim | `--accent-primary-dim` | `rgba(255, 59, 48, 0.18)` |
| AI accent | `--accent-ai` | `#b0b0b0` |
| AI text | `--accent-ai-text` | `#d8d8d8` |
| Positive / up | `--state-success` | `#8fbf5a` |
| Negative / down | `--state-error` | `#f08e7d` |
| Warning / stale | `--state-warning` | `#f6c669` |
| Neutral / flat | `--state-neutral` | `#8a8a8a` |

### Light Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#fafafa` |
| Surface | `--bg-surface` | `#f2f2f2` |
| Elevated surface | `--bg-elevated` | `#ebebeb` |
| Subtle surface | `--bg-subtle` | `#e4e4e4` |
| Default border | `--border-default` | `#dcdcdc` |
| Subtle border | `--border-subtle` | `#c8c8c8` |
| Primary text | `--text-primary` | `#171717` |
| Secondary text | `--text-secondary` | `#3d3d3d` |
| Muted text | `--text-muted` | `#4f4f4f` |
| Faint text | `--text-faint` | `#5a5a5a` |
| Brand accent (fire red) | `--accent-primary` | `#b91c1c` |
| Brand hover | `--accent-hover` | `#991b1b` |
| Brand dim | `--accent-primary-dim` | `rgba(185, 28, 28, 0.10)` |
| AI accent | `--accent-ai` | `#4f4f4f` |
| AI text | `--accent-ai-text` | `#3d3d3d` |
| Positive / up | `--state-success` | `#336d18` |
| Negative / down | `--state-error` | `#b3261e` |
| Warning / stale | `--state-warning` | `#7d5800` |
| Neutral / flat | `--state-neutral` | `#4f4f4f` |

### globals.css Pattern

```css
:root {
  /* dark mode defaults */
  --bg-base: #0d0d0d;
  --accent-primary: #ff3b30;
  /* ... */
}

[data-theme="light"] {
  --bg-base: #fafafa;
  --accent-primary: #b91c1c;
  /* ... */
}
```

Toggle: set `document.documentElement.dataset.theme = 'light' | 'dark'`. Persist to localStorage.

---

## Typography

| Role | Font | CSS Variable |
|------|------|-------------|
| UI text | Geist Sans | `--font-geist-sans` |
| Code / mono | Geist Mono | `--font-geist-mono` |
| Metric numbers | Geist Mono | `--font-geist-mono` |

Both loaded via `next/font/google`, applied as CSS variables on `<html>`. Body uses Geist Sans with `antialiased`. All metric values (traffic, rankings, CTR) displayed in Geist Mono for scan-readability.

---

## Border Radius

| Context | Class |
|---------|-------|
| Badges / inline | `rounded-lg` |
| Metric cards / panels | `rounded-2xl` |
| Modal / overlay | `rounded-3xl` |
| Buttons | `rounded-xl` |

---

## Dropdown / Menu Spacing

Account-style menus (`DropdownMenu*`) share one spacing rhythm — account block, then a separator, then actions:

```
DropdownMenuContent: w-60 (primitive default p-1)
├── DropdownMenuLabel: flex flex-col gap-1 px-1.5 py-1.5
│   ├── name:  text-sm font-medium text-foreground
│   └── email: text-xs font-normal text-muted-foreground
├── DropdownMenuSeparator
└── DropdownMenuItem: primitive default (px-1.5 py-1)
```

- Label horizontal padding matches item padding so the name/email align with the menu item icons.
- Always place a `DropdownMenuSeparator` between the account block and its action items — never let the header sit flush against the first item.
- Name and email are different sizes (`text-sm` / `text-xs`); never render both at one size.

---

## Dashboard-Specific UI Patterns

### Metric Cards

```
Card className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between"   (shadcn Card supplies surface + border)
├── Label: text-xs text-text-muted        (CardHeader, p-0)
├── Value: text-2xl font-mono font-medium tracking-tight text-text-primary
├── Delta: text-xs font-mono + state utility (↑ 4.2% / ↓ 1.8%)
└── Footnote: text-[11px] text-text-muted (CardFooter, p-0 border-none bg-transparent)
```

### Trend Indicators

- Up: `text-state-success` · Down: `text-state-error` · Flat/absent: `text-text-muted`
- The arrow is a lucide icon (`ArrowUpRight` / `ArrowDownRight`, `size-3`, `aria-hidden="true"`) —
  never a raw `↑`/`↓` character. Direction and magnitude must also be in the text
  ("`{n} gained`" / "`{n} lost`" in the query table), because color and an aria-hidden glyph are
  invisible to screen readers.
- Never use raw green/red — always state tokens.

Utility names come from the `@theme inline` block in `globals.css` (`--color-state-success` →
`text-state-success`), **not** from the raw primitives. The primitive tables above are the values a
token resolves to; `text-success`, `bg-warning` and `text-neutral` are not utilities in this project
and silently produce no style. Check `app/globals.css` before inventing one.

### Stale Data Banner

Rendered by `dashboard-hero.tsx` when `overview.staleSource` is true:

```
role="status" bg-state-warning/10 border border-state-warning text-state-warning
rounded-xl px-4 py-2 text-xs
"Data from {lastUpdated} — last sync failed. Showing cached results."
```

`staleSource` mirrors `current_metrics.is_stale`, which nothing writes yet, so this banner is
reachable in code but not in practice (see `context/progress-tracker.md`).

### Sync Status Pill

`dashboard-header.tsx`: a rounded-full chip with a pulsing `h-1.5 w-1.5` dot, hidden below `md`.

- Stale: `bg-state-warning/10 text-state-warning` + `bg-state-warning` dot
- Fresh: `bg-secondary text-primary` + `bg-primary` dot
- Label is `overview.syncStatus`, assembled in `lib/dashboard/overview.ts` — the component never
  computes freshness itself (invariant 9).

### Keyword Rank Display

Today the query table renders rank as plain `#{rank}` in `font-mono font-medium`, with no
tier colouring; `--color-accent-primary-dim` and `--color-state-neutral` exist as tokens but no
component uses them yet. If rank tiers are ever introduced, keep them on the
`bg-state-*/10 + text-state-*` pair (10% tint + full-strength text) rather than adding new raw
colours, and note `--accent-primary-dim` is a red tint — it is the brand accent, not a "top 3" signal.

### Loading Skeletons

- `DashboardSkeleton` (`components/features/dashboard/components/dashboard-skeleton.tsx`) is the `/dashboard` Suspense fallback and mirrors the real layout 1:1 — header, hero (domain line + h1 + range/tabs), 4 metric cards, 2/1 chart + brief grid, query table, AI grid, footer.
- Placeholder blocks use `bg-border/70` + `motion-safe:animate-pulse` (respects reduced motion); heights match the real content (`h-80` chart, `h-9` hero lines, matching card padding) so the early skeleton paint is the LCP candidate and no layout shift occurs when real data swaps in.
- Server component, no client JS. Root carries `aria-busy="true"`, `aria-live="polite"`, and an `sr-only` "Loading dashboard" label.

---

## Layout Patterns

- **Dashboard:** full-viewport, top navbar, left sidebar (collapsible), main content area.
- **Sidebar:** `bg-surface border-r border-default`, client nav + metric categories.
- **Admin panel:** *(not built — no `/admin` route and no admin-only API; target-state layout kept
  here so the eventual shell matches the dashboard.)*
- **Modals:** centered overlay, `rounded-3xl`, `bg-elevated`, backdrop blur.
- **Navbar:** `bg-surface border-b border-default`, logo + client name + theme toggle + user avatar.
- **Data tables:** `bg-surface`, alternating `bg-subtle` rows, sticky header.

---

## Component Library

shadcn/ui on Tailwind 4. Components in `components/ui/`. Use `shadcn` CLI to add — never write from scratch. Override styles via token classes only.

## Toasts / Form Feedback

- `components/ui/toast.tsx` (Base UI Toast, added via shadcn) exposes `toast.add({ title, description, type })`; `Toaster` is mounted once in `app/layout.tsx`. The viewport is pinned bottom-right on `sm+` — it is the single feedback surface for form/action status.
- All form interactions run through one lifecycle (`lib/toast-status.ts`): `startStatusToast(title, description)` adds a persistent `"loading"` (spinner) toast; `finishStatusToast(id, { status, title, description, timeout })` flips it in place to `"success"` or `"error"`. Errors auto-dismiss in 8s, successes in 6s, and `timeout: 0` keeps important confirmations (e.g. "check your email") visible until dismissed.
- Copy pattern: titles `"Too many attempts"` / `"Could not complete"` / `"Sign out failed"` / `"Profile saved"` / `"Signed in"`; descriptions are generic user-safe messages.
- Rate limiting: every interactive submit path first checks a per-instance `SlidingWindowLimiter` (`lib/rate-limit.ts`). On rejection show the "Too many attempts" toast and skip the network call; the existing `pending`/`disabled` guard still blocks mid-flight re-submission.
- Submission controls keep their own pending affordance (button label swap + `aria-busy`) — the toast signals global status, the button signals local state.

---

## Motion

- Library: `motion` (Framer Motion), imported from `motion/react`, inside `"use client"` components only.
- Motion is deliberate, not decorative: at most one orchestrated reveal per view, triggered by scroll. Do not animate every section or card.
- Reveal-on-scroll uses the Fragment-Ref `InView` primitive (`components/ui/in-view.tsx`), not `motion`'s `whileInView`. The chart's decorative backdrop layers (offset `bg-secondary` panel + accent glow) were removed (2026-09-18); the only page motion is the `InView` card reveal gated by `useReducedMotion`.
- Always gate transforms and reveals with `useReducedMotion()` — when reduced, render the final state (no transforms, no opacity fade). `InView` consumers combine `revealed || shouldReduceMotion` and add `motion-reduce:transition-none`.
- Decorative layers (glows, backdrop panels) are `aria-hidden="true"` + `pointer-events-none` and never change layout.

### View Transitions (React 19.3)

Dashboard section switches (Overview / Queries / AI Citation) use React's `<ViewTransition>` rather than `motion`:

- Tab panels stay mounted and are shown/hidden with `<Activity mode>` — panel state (e.g. the `QueryTable` filter) survives tab switches, and hidden panels do no background work.
- `<Activity>` nested inside `<ViewTransition>` triggers the enter/exit animation on visibility change.
- `addTransitionType("forward" | "backward")` (inside `startTransition`) selects the direction; classes live in `globals.css` as `vt-enter-forward` / `vt-enter-backward` / `vt-exit-forward` / `vt-exit-backward` / `vt-fade`.
- Panel content animates as a single wrapper element — do not wrap multiple sibling roots in one `<ViewTransition>`.
- All `::view-transition-*` animations are disabled under `prefers-reduced-motion: reduce`; no JS reduced-motion branch is needed for these.
- Keep this as the *one* navigational motion moment; do not also add `motion` transitions to the same panels.

## Landing Page (`/`, marketing) & Auth Pages

Landing palette — always dark, independent of `data-theme`. Active tokens: `landing-bg` `#050201`, `landing-surface` `#191c21`, `landing-surface-2` `#232830`, `landing-border` `#2a2f38`, landing text `#ffffff` / `#a6aeb8` / `#6e7682`, accent `#ea580c`, tints `#ff9e5e` (light orange), `#f2b88d` (warm), `#95a5b8` (neutral).

- Used solely on the landing page (hero glow, metric-card cards, icon chips); the app surfaces keep the structured tokens above.
- Entrance animations, uploadthing-style: `animate-landing-fade-in` (opacity), `animate-landing-fade-down` (opacity + −y), `animate-landing-scale-in` (opacity + scale) — gated `motion-safe:` so `prefers-reduced-motion` receives final state. Delays via inline `animation-delay` for the metric grid.
- Hero backdrop: two decorative `radial-gradient` glows (sky top-center, mint lower-left) — `aria-hidden` + `pointer-events-none`; layout unaffected.
- No CTA buttons and no footer on the landing page (removed per request); single header text link to `/auth/login`.
- `SiteHeader` / `SiteFooter` (`components/features/landing/`) are shared page chrome with a `tone` prop: `"landing"` (landing palette) or `"default"` (app tokens). Auth pages wrap in `AuthPageShell` (header + centered `AuthCard` + footer, app tokens + full-height layout) — also on forgot/reset pages.
- Auth pages use one `AuthFlow` client component (`email-password-auth`): the sign-in and sign-up forms share a card and flip in place with a motion crossfade (`AnimatePresence mode="wait"`), fields stay email + password, `Continue with Google` (outline) sits below the divider under the fields. Login/sign-up pages are chrome-less (`AuthPageShell chrome={false}`) — no site header/footer; a "Back to home" link (left, aligned with "Forgot your password?" on the right) heads back to `/`. Forgot/reset pages keep the header/footer chrome.

## Charts & Data Viz

- Library: Recharts (already in stack).
- Colors: always use CSS token vars — pass via `stroke={var(--accent-primary)}`.
- Grid lines: `--border-subtle` color, dashed.
- Tooltip: `bg-elevated border-default rounded-xl text-primary`.
- No chart titles — use card label above chart instead.
- Sparklines: single-color, no axes, no tooltip (overview only).

---

## Icons

Lucide React. Stroke-based only — no filled variants.

| Context | Size |
|---------|------|
| Inline / label | `h-4 w-4` |
| Buttons | `h-5 w-5` |
| Empty states | `h-8 w-8` |
| Trend arrows | `h-3 w-3` |

Trend up/down icons: `TrendingUp` / `TrendingDown` from Lucide. Color via state tokens, not icon props.