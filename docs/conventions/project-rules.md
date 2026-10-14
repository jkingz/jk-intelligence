# PROJECT RULES — Rules 11–17

Project-specific constraints for this repo. `AGENTS.md` § STANDING RULES holds the portable rules 1–10 and points here. Read this file in full before every taskable request, together with `AGENTS.md`. Numbering is kept from when these rules lived in `AGENTS.md`, so `§ PROJECT RULES 13` means rule 13.

### 11. Package manager and runtime
- pnpm only (`pnpm-lock.yaml`). `package-lock.json` was deleted deliberately — do not regenerate it with npm.
- Node `>=24` per `package.json` engines; patched dependency `next-themes` comes from `patches/`.

### 12. Next.js 16 is a fork of what you remember
- Read the matching guide in `node_modules/next/dist/docs/` before touching framework APIs (`proxy.ts` not `middleware.ts`, `RouteContext`, two-arg `revalidateTag`).
- `next dev` rewrites only the marker block at the top of `AGENTS.md`. Commit it with your work, never delete it. Mechanism: `docs/maintenance/README.md` § EDITING THE AGENT DOCS.

### 13. Verification gates
- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` must be green before reporting work complete. CI (`.github/workflows/ci.yml`) runs those four plus `pnpm test:e2e`. CI is **not** the push gate: it never runs `pnpm test:all` (integration) or `pnpm test:e2e:auth`. Commands and their scripts: `docs/context/development-workflow.md` § Development Workflow → Project appendix → Commands.
- Tests live in `tests/<feature>/<tier>/` (tiers `unit`, `integration`, `e2e`). Feature → owner table: `docs/architecture/README.md` § SERVICE ARCHITECTURE → Verification. Name files `<sut>.test.ts` (unit, integration) or `<flow>.spec.ts` (e2e). Import the **subject under test** through `@/`, never relatively: a `./` specifier can resolve to a neighbouring file of the same name. `tests/helpers/` and `tests/fixtures/` are support, not subjects, and are imported relatively.
- Unit tests mock at the module boundary, never inside business logic, and make no real network or DB call. The integration tier is the exception by design: it runs real Postgres.
- `pnpm test` is the **unit project only**. `pnpm test:integration` and `pnpm test:all` need the local stack and a filled `.env.test` (names in `.env.test`). Integration files gate on `describe.skipIf(!hasTestDb)` (`tests/helpers/db.ts`, keyed on `TEST_SUPABASE_URL` being set), so a green run can mean nothing ran: read passed/skipped counts from the output, not the exit code. Narrow with `pnpm test dashboard`, never `pnpm test -- dashboard`, which silently runs everything.
- **The push gate** — `pnpm test:all` and `pnpm test:e2e`, on top of the four-chain above, which only gates *reporting*. It has three outcomes and exactly two are pushable:
  - **green** — every tier ran and passed, counts quoted from the run.
  - **waived** — the tier's own dependency is absent, so it cannot run here: no local stack, no `.env.test` names, no browser credentials. Waiving is the owner's decision, per push, never once-and-forever; the reply and the PR body both name the tier and the reason, in the `docs/maintenance/README.md` § VERIFICATION STANDARDS phrasing.
  - **red** — the tier reached its dependency and an assertion failed. Stops: nothing is pushed, no PR is opened, and the cause is fixed before retrying.
- Waived vs red is decided by the output, not the exit code. `skipIf` keys off `TEST_SUPABASE_URL` being *set*, not reachable, so a stack-less integration run **fails** (`fetch failed`, `ECONNREFUSED`) rather than skipping. A file that fails on an assertion while its neighbours pass is red.
- Each route handler under `app/` gets a `<name>-route.test.ts`. Required cases (401, 403, 400, 503, no-data-before-auth) and the two-tenant fixture: `.claude/skills/testing/SKILL.md` § Coverage every route handler needs.

### 14. Read order
Every taskable request: `AGENTS.md` (rules 1–10) → this file → `AGENTS.md` § Reference map → the file your task points at. For architectural decisions, the `docs/context/` files in map order. What exists: `docs/architecture/README.md` § SERVICE ARCHITECTURE; what does not: `docs/target-state/README.md` § TARGET STATE. Per-unit feature specs: `specs/`. The rolling log `docs/progress-tracker.md` is history, not required reading; `docs/context/project-overview.md` § Project Overview → Status and § Open product questions decide what is current.

The `§` marker these citations are written in — here and in every other file in this repo — is defined in `docs/maintenance/README.md` § Notation. Editing `AGENTS.md` or any docs home: read that file before the edit, and run its Completeness checks before reporting the docs change done.

### 15. Tenant isolation is RLS's job
- Client-ownership is decided only by `canAccessClient` / `listAccessibleClients` in `lib/db/repository.ts`. No route or helper may re-implement that rule in TypeScript.
- `docs/architecture/README.md` § SERVICE ARCHITECTURE describes implemented code only; anything not built lives in `docs/target-state/README.md` § TARGET STATE. Never cite that section as current behavior, and check a module exists before assuming it does.

### 16. Supabase
- Schema changes are new timestamped files in `supabase/migrations/`, applied with `pnpm db:migrate`; never edit an applied migration.
- Never run a `db:*` script bare on this checkout. `.env` may target hosted production, and every `db:*` script reads it. `db:migrate`, `db:seed` and `db:seed-connections` use `SUPABASE_DB_URL`; `db:demo-user` uses `NEXT_PUBLIC_SUPABASE_URL` with the service-role key. `db:seed-connections --reset` deletes rows. Point these at the intended database first.
- Every table gets RLS matching the role model. `metrics_snapshots` is append-only. Provider key material and `credential_reference` never appear in a response or a log line; `api_credentials` status columns (`client_id`, `source`, `created_at`) may.
- Env names: `.env.example` (every name, placeholder values) and `.env.test` (`TEST_*`). Copy names, never values. Any secret is server-side: never a `NEXT_PUBLIC_*` name, because the client bundle ships it (e.g. `DEMO_PASSWORD` is read server-side and prop-fed to the login page).
- CI needs only the two `NEXT_PUBLIC_*` values; `.github/workflows/ci.yml` sets non-secret placeholders so `pnpm build` can prerender.

### 17. UI conventions
- `next/image` `Image`, never raw `<img>`. SVG sources only if self-authored and script-free.
- shadcn/`components/ui/*` and `lib/supabase/*` are protected foundations: don't edit to make a feature pass.

## Notes on the portable rules

- **Rule 9 (skills):** the skill inventory and which mirror (`.agents/skills/` or `.claude/skills/`) holds each skill is `docs/architecture/README.md` § Repo skills. Check the counterpart before editing a skill.
