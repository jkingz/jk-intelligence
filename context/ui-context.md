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
bg-surface rounded-2xl border border-default p-5
├── Label: text-muted text-xs uppercase tracking-wide
├── Value: text-primary text-2xl font-mono font-semibold
├── Delta: text-success/error text-sm (↑ 4.2% / ↓ 1.8%)
└── Sparkline: accent-primary color, 48px height
```

### Trend Indicators

- Up: `text-success` + `↑` prefix
- Down: `text-error` + `↓` prefix
- Flat: `text-neutral` + `→` prefix
- Never use raw green/red — always state tokens

### Stale Data Banner

```
bg-warning/10 border border-warning text-warning rounded-xl px-4 py-2
"Data from [timestamp] — syncing failed. Showing cached results."
```

### Keyword Ranking Badges

- Top 3: `bg-accent-primary-dim text-accent-primary`
- Top 10: `bg-success/10 text-success`
- Top 20: `bg-neutral/10 text-neutral`
- Outside 20: `text-muted`

### Sync Status Indicators

- Active / success: `bg-success/10 text-success` dot + label
- Failed: `bg-error/10 text-error` dot + label
- Stale (>24hrs): `bg-warning/10 text-warning` dot + label
- Pending: `bg-muted/10 text-muted` animated dot

### Loading Skeletons

- `DashboardSkeleton` (`components/features/dashboard/components/dashboard-skeleton.tsx`) is the `/dashboard` Suspense fallback and mirrors the real layout 1:1 — header, hero (domain line + h1 + range/tabs), 4 metric cards, 2/1 chart + brief grid, query table, AI grid, footer.
- Placeholder blocks use `bg-border/70` + `motion-safe:animate-pulse` (respects reduced motion); heights match the real content (`h-80` chart, `h-9` hero lines, matching card padding) so the early skeleton paint is the LCP candidate and no layout shift occurs when real data swaps in.
- Server component, no client JS. Root carries `aria-busy="true"`, `aria-live="polite"`, and an `sr-only` "Loading dashboard" label.

---

## Layout Patterns

- **Dashboard:** full-viewport, top navbar, left sidebar (collapsible), main content area.
- **Sidebar:** `bg-surface border-r border-default`, client nav + metric categories.
- **Admin panel:** same layout, additional client list in sidebar.
- **Modals:** centered overlay, `rounded-3xl`, `bg-elevated`, backdrop blur.
- **Navbar:** `bg-surface border-b border-default`, logo + client name + theme toggle + user avatar.
- **Data tables:** `bg-surface`, alternating `bg-subtle` rows, sticky header.

---

## Component Library

shadcn/ui on Tailwind 4. Components in `components/ui/`. Use `shadcn` CLI to add — never write from scratch. Override styles via token classes only.

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