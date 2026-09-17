# UI Context

## Theme

Dark/light mode supported. Default: dark. Toggle via `data-theme` attribute on `<html>`. Visual language: warm charcoal surfaces, brick accent, paper text, clean data-dense reporting UI. Palette adapted from structurewebworks.com.

All colors defined as CSS custom properties in `globals.css`, mapped to Tailwind via `@theme inline`. Components use tokens only — no hardcoded hex or raw Tailwind color classes like `zinc-*` or `slate-*`.

### Dark Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#141412` |
| Surface | `--bg-surface` | `#1a1a17` |
| Elevated surface | `--bg-elevated` | `#232320` |
| Subtle surface | `--bg-subtle` | `#2a2a26` |
| Default border | `--border-default` | `#32322d` |
| Subtle border | `--border-subtle` | `#45453f` |
| Primary text | `--text-primary` | `#fafaf7` |
| Secondary text | `--text-secondary` | `#c4c4ba` |
| Muted text | `--text-muted` | `#9a9a90` |
| Faint text | `--text-faint` | `#6f6f66` |
| Brand accent (brick) | `--accent-primary` | `#c14a2c` |
| Brand hover | `--accent-hover` | `#d4643f` |
| Brand dim | `--accent-primary-dim` | `rgba(193, 74, 44, 0.14)` |
| AI accent | `--accent-ai` | `#9a9a90` |
| AI text | `--accent-ai-text` | `#c4c4ba` |
| Positive / up | `--state-success` | `#8fbf5a` |
| Negative / down | `--state-error` | `#f08e7d` |
| Warning / stale | `--state-warning` | `#f6c669` |
| Neutral / flat | `--state-neutral` | `#6f6f66` |

### Light Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#fafaf7` |
| Surface | `--bg-surface` | `#f1f1ec` |
| Elevated surface | `--bg-elevated` | `#e5e5de` |
| Subtle surface | `--bg-subtle` | `#e5e5de` |
| Default border | `--border-default` | `#e5e5de` |
| Subtle border | `--border-subtle` | `#d8d8d0` |
| Primary text | `--text-primary` | `#141412` |
| Secondary text | `--text-secondary` | `#45453f` |
| Muted text | `--text-muted` | `#6f6f66` |
| Faint text | `--text-faint` | `#9a9a90` |
| Brand accent (brick) | `--accent-primary` | `#c14a2c` |
| Brand hover | `--accent-hover` | `#a63d22` |
| Brand dim | `--accent-primary-dim` | `rgba(193, 74, 44, 0.10)` |
| AI accent | `--accent-ai` | `#9a9a90` |
| AI text | `--accent-ai-text` | `#45453f` |
| Positive / up | `--state-success` | `#6d9a3d` |
| Negative / down | `--state-error` | `#d4543f` |
| Warning / stale | `--state-warning` | `#c99b32` |
| Neutral / flat | `--state-neutral` | `#6f6f66` |

### globals.css Pattern

```css
:root {
  /* dark mode defaults */
  --bg-base: #141412;
  --accent-primary: #c14a2c;
  /* ... */
}

[data-theme="light"] {
  --bg-base: #fafaf7;
  --accent-primary: #c14a2c;
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