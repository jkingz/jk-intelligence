# JK Intelligence

Multi-client SEO reporting platform built with Next.js, TypeScript, Supabase, and shadcn/ui. Product scope and implementation status live in [context](context/project-overview.md) and the [progress tracker](context/progress-tracker.md).

## Dashboard

![JK Intelligence dashboard on the deployed app, with a Lighthouse audit panel beside it](docs/screenshots/dashboard-overview.png)

Deployed at `jk-intelligence.vercel.app`, dark theme, one client ("Atlas Coffee") on the Last 7 days range.

- **Header.** Client switcher, sync-status pill (`Cached data — last sync failed`), Trigger Sync, Export (CSV/PDF), theme toggle, account menu.
- **Hero.** `ATLAS.EXAMPLE · ORGANIC PERFORMANCE REPORT · SEP 12 – SEP 18, 2026` over the growth headline "Organic momentum up 84.0% over 7 days.", plus the `7 | 30 | 90` day-range select and Overview / Queries / AI Citation tabs.
- **Stale banner.** Server-set `is_stale` surfaced verbatim: "Data from Sep 18, 2026 — last sync failed. Showing cached results." Dashboard keeps serving cached metrics instead of failing.
- **Metric cards.** Total Clicks 3,634 (↑84.0% vs 1,975 previous period), Impressions 89,393 with CTR 4.07% · 78 conversions, AI Search Engine Citations "Not available — no AI citation source connected", Avg Position 15.7 with 3 keywords in Top 3.
- **Trend chart.** Search clicks area series for the selected range, recharts, below the cards.
- **Audit.** Lighthouse on this page: Performance 99, Accessibility 100, Best Practices 100, SEO 100. The static-shell boot path plus one `/api/dashboard/boot` request is what keeps the login render fast; the accessibility pass covers the skeleton/`aria-busy` loading state and the labelled header controls.

## Architecture

![JK Intelligence architecture](docs/architecture.svg)

## Development

Requires Node.js >=22.9 and pnpm >=10 (see `package.json`).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Auth requires local environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` supported)

Configure Supabase providers and redirect URLs for the auth flows. Keep credentials out of Git. Live auth verification and outstanding setup are tracked in [progress tracker](context/progress-tracker.md).

## Checks

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## Feature Workflow

Read [AGENTS.md](AGENTS.md) and its ordered context files before implementation.

- Specs: `context/feature-specs/<nn>-<slug>.md`.
- Components: `components/features/<slug>/`, public exports through `index.ts`.
- Numbers belong only to spec filenames; feature folders/imports stay unnumbered.
- Mark tracker **In Progress** before implementation; complete after verification.
- PR branches: `feat/<slug>`; titles: `feat(<slug>): <summary>`. Commit/push/PR only when requested.

Full rules: [feature conventions](docs/conventions/feature-components.md).

## Feature Command

In OpenCode, use the project slash command:

```text
/feature-component context/feature-specs/03-user-profile.md
/feature-component add a feature for saved reports
```

The command loads [feature-component](.claude/skills/feature-component/SKILL.md), follows the spec-first workflow, and wires pages through the feature barrel. With no arguments, it asks which feature to work on.

- Command: `.opencode/commands/feature-component.md`
- Skill: `.claude/skills/feature-component/SKILL.md`
- Shared discovery link: `.agents/skills/feature-component`

Quit and restart OpenCode after command/skill changes. `/help` shows OpenCode usage help.
