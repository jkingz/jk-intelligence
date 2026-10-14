# JK Intelligence

Multi-client SEO reporting platform: Next.js 16, React 19, TypeScript, Supabase (Postgres + RLS + auth), shadcn/ui, BullMQ on Upstash.

- Scope and status: [docs/context/project-overview.md § Project Overview → Status](docs/context/project-overview.md#status); [docs/progress-tracker.md](docs/progress-tracker.md) is the dated log behind it, not the live record. `§` names a section — the notation is defined in [docs/maintenance/README.md § Notation](docs/maintenance/README.md#notation).
- Built vs planned: [docs/architecture/README.md § SERVICE ARCHITECTURE](docs/architecture/README.md#service-architecture--implemented-surface) describes implemented code only; [docs/target-state/README.md § TARGET STATE](docs/target-state/README.md#target-state) holds unbuilt design intent and is never current behaviour.

## Dashboard

![JK Intelligence dashboard, seeded demo data](docs/screenshots/dashboard-overview.png)

Deployed at `jk-intelligence.vercel.app`. Screenshot: dark theme, one client ("Atlas Coffee"), Last 7 days — taken before the shell gained its left rail, so the account avatar it shows at the header's right edge now lives in the rail's footer (`NavUser`). Current shell: a collapsible destination rail (Dashboard, Connections) on `md+`, a top bar with a drawer trigger below it. The header keeps the client switcher, sync pill, Trigger Sync, CSV/PDF export and theme toggle; under it sit the hero headline, `7 | 30 | 90` range select, metric cards, click-trend chart and query table.

Not live yet, do not demo them as working:

- **Sync.** No consumer runs the queue — `lib/queue/worker.ts` returns `mock_completed`, and Trigger Sync only animates its own state. All metric rows come from `pnpm db:seed`; the `api_credentials` rows `/connections` renders come from `pnpm db:seed-connections` — both placeholders.
- **Stale banner / sync pill.** Reads the stored `is_stale` column; nothing writes it, so it cannot fire outside seed data.
- **AI citations.** `aiCitations` is a hardcoded `[]`, so the card and grid always render their empty state. No LLM dependency exists.

## Architecture

![JK Intelligence architecture](docs/architecture.svg)

Request path, the RLS-backed tenant gate and the HTTP surface: [docs/architecture/README.md](docs/architecture/README.md). Deep boundaries: [docs/context/architecture-context.md § Architecture Context](docs/context/architecture-context.md#architecture-context).

## Development

Node `>=24`, pnpm `>=10` (`package.json` engines). pnpm only — `package-lock.json` was deleted on purpose.

```bash
pnpm install
pnpm dev    # http://localhost:3000
```

Local auth needs two names in `.env`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` still works). Server-side paths also want `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, and the private `DEMO_EMAIL`/`DEMO_PASSWORD`. Copy `.env.example` and fill it in — never copy values between machines. Register the Supabase providers and add `/auth/callback` to the redirect allowlist, then `pnpm db:migrate && pnpm db:seed` for demo data.

## Checks

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

`pnpm test` is the Vitest **unit** project only. Tests live in `tests/<feature>/<tier>/`, so the
full picture needs `pnpm test:all` (adds the live-RLS integration tier, which needs
`pnpm exec supabase start` and `.env.test` and skips without it) plus `pnpm test:e2e` and
`pnpm test:e2e:auth` for the Playwright tiers — the public tier runs in CI after the build, the
authed tier is local-only because it needs real credentials.

CI (`.github/workflows/ci.yml`) runs the four above plus the public e2e tier on every push to
`main`/`dev` and on pull requests.

## Feature workflow

Read [AGENTS.md](AGENTS.md) before implementing: § STANDING RULES, then the § Reference map and the
docs files it names, in that table's order.

- Specs: `specs/<nn>-<slug>.md`. Components: `components/features/<slug>/`, exported through `index.ts`. Numbers belong only to spec filenames.
- Tracker: record the unit under `docs/progress-tracker.md`'s `## Completed` **after** verification; the four history sections stay as they are. Current status lives in `docs/context/project-overview.md` § Project Overview → Status and § Open product questions.
- Branches `feat/<slug>`, titles `feat(<slug>): <summary>`. Commit, push and open PRs only when asked.
- Full rules: [docs/conventions/feature-components.md](docs/conventions/feature-components.md).

OpenCode only: `/feature-component <spec>` runs the [feature-component](.claude/skills/feature-component/SKILL.md) skill (command file `.opencode/commands/feature-component.md`, link `.agents/skills/feature-component`). No argument → it asks. Restart OpenCode after editing commands or skills.
