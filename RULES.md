# Project RULES — read FIRST, before any task

Standing constraints. Read this file before every taskable request. Skip nothing; all rules apply to every change.

Rules 1–10 are the **portable core** — they hold in every repo this workspace touches, and belong in any new project's `RULES.md` verbatim. Rules 11–17 are **this repo's** appendix.

## Portable core

### 1. Be very concise
- Keep responses short. Sacrifice grammar for the sake of concision.
- No preamble, no "here is what I did" essays. State the change + the result + the one thing you need from me.

### 2. No "done" without a command behind it
- Every claim of completion names the command run and what it printed (`pnpm test` → `113 passed`; `curl` → the status code).
- Untested by you = unverified. Say "not verified" instead of "should work".
- Type-checking proves types, not behavior. CI passing proves the push, not the feature.

### 3. Scope is the request, not the opportunity
- The blast radius of a change equals the radius of what was asked. Fix the reported defect.
- No drive-by cleanup, renames, formatting, "while I'm here" extractions, predicted abstractions, or extra flags and compat shims.
- Nearby problems you spotted: **one line in the reply**. Not in the diff.
- Ask "was this in the request?" before touching it. If no, stop.

### 4. Delete unused, but prove it was unused
- Remove dead files, exports, imports, env vars, CSS, tokens and orphaned components as you go.
- Grep for callers before deleting; state what you removed and how you checked.
- Never delete a doc, branch, migration, or config you do not understand — report it instead.

### 5. Servers, ports, processes
- Restart or kill running servers/ports **only during the current task**.
- Clear stale processes on ports the app uses before starting your own.
- End a session with no orphaned dev server, queue worker, or background job. Stop what you started.

### 6. Secrets
- Never print a secret value — reference it by name. Redact anything that appears in output.
- `.env*` stays out of git. Only names and empty placeholders go into committed files.
- Service-role / privileged keys stay server-side, never in a `NEXT_PUBLIC_*` variable or the client bundle.

### 7. Git discipline
- Commit, push, open or merge a PR **only when asked**.
- Before pushing to `dev`: `git pull` from `origin main`, merge, resolve conflicts, then commit/push. Never push to `dev` without that pull.
- No `--no-verify`, no skipped hooks, no bypassed signing. A failing hook is a finding to fix at the cause.
- Never force-push a shared branch, and never `git reset --hard` / `clean -f` / `checkout --` over work you did not write. Check `git status` first; stash or commit anything unexpected.
- Destructive or externally visible actions (closing a PR, deleting a branch, dropping a table, sending messages) need explicit authorization — every time, not once-and-forever.

### 8. Pull-request babysitting
- When watching a PR: follow the `babysitting-a-pr` skill. Act only on checks and comments newer than the latest push, and verify every bot finding against the source before changing code.
- Every comment posted on my behalf follows `leaving-pr-comment`: its triggers, its body contract, and the mandatory first-line AI-authorship disclaimer.
- No filler comments. No scope creep while responding to review. A finding you decline gets a written decline, then the thread is resolved.

### 9. Skills and instructions come before improvising
- Check available skills before starting a task; if one applies, use it rather than re-deriving the workflow.
- A harness capability (scheduled runs, subagents, MCP tools) that exists is used — do not hand-write a loop the platform already provides.
- New reusable procedure worth keeping becomes a skill, tested before it is trusted.

### 10. Unknowns are labelled, not invented
- No fabricated thresholds, policies, precedents, APIs or file paths. If you cannot point at it, say you cannot point at it.
- State assumptions plus the step that would verify them. Missing requirement → record it as an open question, then continue.
- When implementation and docs disagree, code is truth and the doc is a defect: fix the doc in the same change.

## This repo

### 11. Package manager and runtime
- pnpm only (`pnpm-lock.yaml`). `package-lock.json` was deleted deliberately — do not regenerate it with npm.
- Node `>=24` per `package.json` engines; patched dependency `next-themes` comes from `patches/`.

### 12. Next.js 16 is a fork of what you remember
- Read the matching guide in `node_modules/next/dist/docs/` before touching framework APIs (`proxy.ts` not `middleware.ts`, `RouteContext`, two-arg `revalidateTag`).
- The `## Standing Rules` / context block at the top of `AGENTS.md` is written by `next dev`; committing it keeps the tree clean.

### 13. Verification gates
- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` must be green before reporting work complete; CI (`.github/workflows/ci.yml`) runs these four plus `pnpm test:e2e` (public tier only).
- Tests live in `tests/<feature>/<tier>/` — features `identity`, `tenant-isolation`, `dashboard`, `export`, `sync`, `landing`, `platform`; tiers `unit`, `integration`, `e2e`. `AGENTS.md` lists what each feature owns. Name the file `<sut>.test.ts` (unit/integration) or `<flow>.spec.ts` (e2e); import the **subject under test** through `@/`, never relatively — a `./` specifier can silently resolve to a neighbouring file of the same name. Shared helpers under `tests/helpers/` are the one exception and may be imported relatively.
- Unit tests mock at the boundary (`@/lib/agents/...`, `@/lib/db/repository`) — never inside business logic, and never make a real network or DB call. That last clause is **unit-tier only**: the integration tier exists precisely to put a real Postgres behind `canAccessClient`.
- `pnpm test` is the **unit project**, not the whole suite. The integration tier currently holds **no files** — `pnpm test:integration` and `pnpm test:all` pass on `--passWithNoTests`, which is green meaning nothing; once files exist they skip silently without `TEST_SUPABASE_URL` (the `setupFiles` warning cannot fire on an empty tier, measured). E2E is a separate runner. Run `pnpm test:all` and `pnpm test:e2e` before pushing. Narrow with `pnpm test dashboard`, never `pnpm test -- dashboard` — the latter silently runs everything.
- Route handlers get a `<name>-route.test.ts` covering 401 / 403 / 400 and the no-data-leaked-before-auth path.

### 14. Read `context/` in order before implementing
`project-overview` → `architecture-context` → `ui-context` → `code-standards` → `development-workflow` → `progress-tracker`; plus `pm-conventions.md` for commit/PR shape and `feature-specs/NN-*.md` for the unit you are building. Then `RULES.md`. Update the file your change invalidates, and `progress-tracker.md`, before continuing.

### 15. Tenant isolation is RLS's job
- Client-ownership is decided only by `canAccessClient` / `listAccessibleClients` in `lib/db/repository.ts`. No route or helper may re-implement that rule in TypeScript.
- `AGENTS.md` describes implemented code only; anything not built lives in `docs/target-state.md`. Never cite target-state as current behavior, and check a module exists before assuming it does (`lib/agents/` holds only `authAgent`).

### 16. Supabase
- Schema changes are new timestamped files in `supabase/migrations/`, applied with `pnpm db:migrate`; never edit an applied migration.
- Every table gets RLS matching the role model. `metrics_snapshots` is append-only. Credentials never appear in a response or a log line.
- Local runs need `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`; server-side also `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`. There is no `.env.example` yet — copy names from `.env` (values are secrets; never commit them).
- CI needs only the two `NEXT_PUBLIC_*` values; `.github/workflows/ci.yml` sets non-secret placeholders so `pnpm build` can prerender.

### 17. UI conventions
- `next/image` `Image`, never raw `<img>`. SVG sources only if self-authored and script-free.
- shadcn/`components/ui/*` and `lib/supabase/*` are protected foundations: don't edit to make a feature pass.
