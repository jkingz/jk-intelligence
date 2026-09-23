<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
## Standing Rules (read first)
Read `RULES.md` at the repo root before anything else on every task — concise output, server/port hygiene, and removing unused project stuff apply to all future work, not just this session.

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — product definition, goals, features, and scope
2. `context/architecture-context.md` — system structure, boundaries, storage model, and invariants
3. `context/ui-context.md` — theme, colors, typography, canvas design, and component conventions
4. `context/code-standards.md` — implementation rules and conventions
5. `context/development-workflow.md` — development workflow, scoping rules, and delivery approach
6. `context/progress-tracker.md` — current phase, completed work, open questions, and next steps

Project-wide convention: all images use `next/image` (`Image`), never a raw `<img>` element (enforced by `@next/next/no-img-element`). SVG sources are allowed for self-authored, script-free assets only. Details in `context/code-standards.md` → "Images".

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing.

# SERVICE ARCHITECTURE — implemented surface

This file describes only code that exists. Design intent for what is **not** built lives in
`docs/target-state.md`; never cite that file as current behavior.

## Request path

```
proxy.ts (session refresh via updateSession)
  → app/api route handler
    → lib/agents/authAgent      — identity + role
    → lib/db/repository         — RLS-backed tenant gate, then metric reads
  → components/features/*       — dashboard reads /api/dashboard/boot client-side
```

## Agents (`lib/agents/`)

| Module | Status |
| --- | --- |
| `authAgent.ts` | implemented: `getAuthSession()`, `getAuthUser()`, `requireAdmin()` |
| `syncAgent` / `transformAgent` / `cacheAgent` / `insightsAgent` | **do not exist** — spec only, see `docs/target-state.md` |

`authAgent` answers identity and role. It must not grow a copy of the client-ownership rule.

## Tenant isolation — one gate, enforced by RLS

- `canAccessClient(clientId)` and `listAccessibleClients()` in `lib/db/repository.ts` read the
  `clients` table through the per-request Supabase client (`createServerSupabaseClient()`:
  publishable key + session cookie), so Postgres decides visibility. Both fail closed.
- No route or helper may re-implement "is this the caller's client?" in TypeScript.
- Metric/keyword reads deliberately use the service-role client (`getAdminDb()`, RLS bypassed)
  because they run inside `unstable_cache`; they are reachable only with a `client_id` that already
  cleared the gate.
- Roles `admin | client | staff` come from the `users` row via `security definer` helpers
  (`private.current_user_role()`, `private.current_user_client_id()`) — never from JWT claims.

```ts
// lib/db/repository.ts — the gate
export async function canAccessClient(clientId: string): Promise<boolean> {
  const db = await createServerSupabaseClient();          // user-scoped: RLS applies
  const { data } = await db.from("clients").select("id")
    .eq("id", idSchema.parse(clientId)).eq("is_active", true).maybeSingle();
  return data !== null;                                   // no visible row == no access
}
```

Policies: `supabase/migrations/20260917000000_seo_poc.sql`,
`20260920000000_add_staff_role.sql`, `20260920000001_rls_hardening.sql`. `api_credentials` has a
`using (false)` select policy and is never read by the app today.

## HTTP surface (what actually exists)

| Route | Method | Auth | Notes |
| --- | --- | --- | --- |
| `/api/dashboard/boot` | GET | session | one payload for the whole dashboard boot: profile + accessible clients + selection |
| `/api/metrics/[clientId]/overview` | GET | session + gate | `?days=` (default 7), `unstable_cache` |
| `/api/metrics/[clientId]/keywords` | GET | session + gate | `?source=gsc\|ga4\|semrush`, rank history |
| `/api/exports/[clientId]/csv` | GET | session + gate | streams via `lib/exports/server.ts` |
| `/api/exports/[clientId]/pdf` | GET | session + gate | pdf-lib + vendored Noto Sans TTFs |
| `/api/revalidate/dashboard` | POST | `CRON_SECRET` bearer | the only path that revalidates `DASHBOARD_OVERVIEW_TAG` |
| `/api/cron/sync` | GET | `CRON_SECRET` bearer | enqueues one job per active client; Vercel cron `0 2 * * *` |

Planned and absent: `POST /api/sync/trigger`, `GET /api/metrics/{clientId}`,
`GET /api/metrics/{clientId}/history`, `GET /api/sync/logs/{clientId}`.

## Queue, worker, cron

- `lib/queue/syncQueue.ts` — BullMQ on Upstash Redis, queue name `seo-sync`, zod-guarded job body.
- `lib/queue/worker.ts` — `pnpm worker` runs it locally. It currently revalidates the dashboard and
  returns `status: "mock_completed"`: no API fetch, no rows written.
- **Nothing consumes the queue in production.** Vercel hosts only the cron; hosting the worker
  (always-on process, inline-in-cron, or QStash) is an open decision — see
  `context/progress-tracker.md`.
- `persistMetrics`, `markMetricsStale` and `writeSyncLog` in `lib/db/repository.ts` exist but have
  zero callers. All dashboard rows today come from `scripts/seed.mjs`.

## Pages and caching

`app/` routes: `/` (landing), `/dashboard`, `/profile`, `/auth/{login,sign-up,forgot-password,
reset-password}`, `/privacy`, `/terms`, plus `app/auth/callback/route.ts` (PKCE exchange).
There is **no** admin panel page, no `sitemap.ts`/`robots.ts`, and no LLM/Claude dependency.

`lib/cache/invalidate.ts` owns `DASHBOARD_OVERVIEW_TAG = "dashboard-overview"`; revalidation happens
only through `POST /api/revalidate/dashboard` (`revalidateTag(tag, profile)`), never from the worker.
`/dashboard` stays a prerendered static shell. `is_stale` is a stored column the UI only reads —
`markMetricsStale()` exists but nothing calls it, so the stale banner can never fire yet.

## Verification

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # the gate
pnpm test:all                                            # + integration (skips without TEST_SUPABASE_URL)
pnpm test:e2e                                            # public Playwright specs
```

`.github/workflows/ci.yml` runs those four plus the public e2e tier on every push to `main`/`dev`
and on pull requests, with non-secret Supabase env placeholders so the build can prerender and the
guard/landing specs can serve without a database. Tests live in `tests/<feature>/<tier>/`
(`unit`, `integration`, `e2e`), never beside the module; mock at module boundaries, never inside
business logic.

| test folder | owns |
| --- | --- |
| `identity` | `lib/agents/authAgent`, `lib/auth/{cron,routing}`, `lib/supabase/*`, `proxy.ts`, the `/auth/*` pages, `components/features/{user-profile,email-password-auth}/lib` |
| `tenant-isolation` | `canAccessClient` / `listAccessibleClients` and the RLS policies in `supabase/migrations/` behind them |
| `dashboard` | `/api/dashboard/boot`, both `/api/metrics/*` routes, `lib/dashboard/*`, `lib/cache/*` tag ownership, `/dashboard` |
| `export` | `/api/exports/[clientId]/{csv,pdf}`, `lib/exports/*`, the export menu |
| `sync` | `/api/cron/sync`, `/api/revalidate/dashboard`, `lib/queue/*` |
| `landing` | `/`, `/privacy`, `/terms`, `components/features/landing/*` |
| `platform` | cross-cutting primitives with no owning feature — today that is `lib/rate-limit.ts` alone |

A test goes in the feature that owns the *invariant the test protects*, not the file it imports.
`lib/rate-limit.ts` has consumers in three features, so it belongs to none of them.

## Repo skills

`.claude/skills/` is the source of truth; `.agents/skills/` mirrors it for other loaders, and the
mirror is **not** one mechanism: some entries are symlinks, some are genuine hardlinks (shared
inode), and some are plain independent copies. Edit the `.claude/` file and then check the
counterpart with `ls -i` / `readlink` rather than assuming either propagates. `.opencode/` carries only `commands/feature-component.md` — its own `.gitignore` keeps
the tool's `node_modules/` and `package.json` untracked, so do not expect skills there.

- `babysitting-a-pr` + `leaving-pr-comment` — how PR review bots, comments and checks get handled
  and worded. Also installed user-level, so they apply to every repo.
- Stack: `code-review`, `feature-component`, `frontend-design`, `shadcn`, `supabase`,
  `supabase-postgres-best-practices`, `tailwind-design-system`, `motion-design`, `playwright-cli`,
  `migrate-radix-to-base`.
- Visual direction: `design-taste-frontend`, `stitch-design-taste`, `high-end-visual-design`,
  `redesign-existing-projects`, `minimalist-ui`, `brandkit`, `gpt-taste`, `image-to-code`,
  `imagegen-frontend-web`, `imagegen-frontend-mobile`.
- `.agents/skills/` mirrors only a 13-entry subset. `ls` both before assuming a skill is reachable
  from another loader, and never edit a skill in one place without the other.

## Editing this file

`AGENTS.md`'s top block ("This is NOT the Next.js you know" through the context-file list) is
regenerated by `next dev` — commit it with your work rather than deleting it. Everything below the
`# SERVICE ARCHITECTURE` heading is hand-maintained: update it in the same change that alters the
surface described here, and move newly built modules out of `docs/target-state.md`.
