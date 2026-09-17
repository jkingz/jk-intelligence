# UI Context

## Theme

Dark/light mode supported. Default: dark. Toggle via `data-theme` attribute on `<html>`. Visual language: deep charcoal surfaces, ember accent, clean data-dense reporting UI.

All colors defined as CSS custom properties in `globals.css`, mapped to Tailwind via `@theme inline`. Components use tokens only — no hardcoded hex or raw Tailwind color classes like `zinc-*` or `slate-*`.

### Dark Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#0f0f0f` |
| Surface | `--bg-surface` | `#161618` |
| Elevated surface | `--bg-elevated` | `#1c1c1f` |
| Subtle surface | `--bg-subtle` | `#222226` |
| Default border | `--border-default` | `#2c2c32` |
| Subtle border | `--border-subtle` | `#3a3a42` |
| Primary text | `--text-primary` | `#f2f0ed` |
| Secondary text | `--text-secondary` | `#b8b4ae` |
| Muted text | `--text-muted` | `#78746e` |
| Faint text | `--text-faint` | `#4a4742` |
| Brand accent (ember) | `--accent-primary` | `#e8622a` |
| Brand dim | `--accent-primary-dim` | `rgba(232, 98, 42, 0.12)` |
| AI accent | `--accent-ai` | `#6457f9` |
| AI text | `--accent-ai-text` | `#8b82ff` |
| Positive / up | `--state-success` | `#34d399` |
| Negative / down | `--state-error` | `#f87171` |
| Warning / stale | `--state-warning` | `#fbbf24` |
| Neutral / flat | `--state-neutral` | `#94a3b8` |

### Light Mode Tokens

| Role | CSS Variable | Hex |
|------|-------------|-----|
| Page background | `--bg-base` | `#f5f4f2` |
| Surface | `--bg-surface` | `#ffffff` |
| Elevated surface | `--bg-elevated` | `#f0eeec` |
| Subtle surface | `--bg-subtle` | `#e8e6e3` |
| Default border | `--border-default` | `#d6d3ce` |
| Subtle border | `--border-subtle` | `#c4c0ba` |
| Primary text | `--text-primary` | `#1a1816` |
| Secondary text | `--text-secondary` | `#4a4642` |
| Muted text | `--text-muted` | `#78746e` |
| Faint text | `--text-faint` | `#a8a49e` |
| Brand accent (ember) | `--accent-primary` | `#d4521a` |
| Brand dim | `--accent-primary-dim` | `rgba(212, 82, 26, 0.10)` |
| AI accent | `--accent-ai` | `#5548e0` |
| AI text | `--accent-ai-text` | `#6c63ff` |
| Positive / up | `--state-success` | `#059669` |
| Negative / down | `--state-error` | `#dc2626` |
| Warning / stale | `--state-warning` | `#d97706` |
| Neutral / flat | `--state-neutral` | `#64748b` |

### globals.css Pattern

```css
:root {
  /* dark mode defaults */
  --bg-base: #0f0f0f;
  --accent-primary: #e8622a;
  /* ... */
}

[data-theme="light"] {
  --bg-base: #f5f4f2;
  --accent-primary: #d4521a;
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