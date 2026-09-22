# Development Workflow

Two parts: a **portable core** that applies to any project, then **this repo's appendix** with the
concrete paths and commands. When the two disagree, the appendix wins for this repo.

---

## Portable core

### The loop, per unit of work
1. Read what governs the change — root rules first, then the context files for the touched module.
2. Say the scope out loud in one sentence: what changes, and what explicitly does not.
3. Implement the smallest increment that can be verified on its own.
4. Verify with a command, never with a claim.
5. Update the docs that the change made untrue — in the same change.
6. Report: what changed, what was verified, what is still unknown.

### Scoping
- One feature unit or one agent at a time.
- Split when a step crosses boundaries: UI + sync agent, schema + API route, cache + auth,
  queue/cron + dashboard, or anything whose behavior is not written down.
- If end-to-end verification of a step is not quick, the scope is too broad — split it.
- **The request is the scope.** An adjacent improvement you noticed is a finding to report,
  not work to do. Fixing a real defect you were asked to fix is not a licence to tidy its neighbours.
- No "while I'm here": no renames, no dependency swaps, no formatting of untouched files.

### Requirements
- Do not invent behavior that is not in the context files.
- Ambiguous → resolve it in the relevant context file, then implement.
- Missing → record it as an open question in the status doc and stop that branch of work.
- A guessed constant, threshold, or policy is a requirement you invented. Label it or drop it.

### Verification
A unit is done when, in this order:
1. tests covering the changed paths pass (new behavior gets a new test in the same change);
2. typecheck passes;
3. lint passes;
4. the production build passes;
5. anything a test cannot reach (a page, a migration, a queue job) was exercised for real, and
   the observation is reported. "It should work" is not a status.

### Docs and truth
- Code is the source of truth. Where a doc and the code disagree, the doc is the defect.
- Design intent that is **not built** belongs in a clearly-named target-state doc, never inline in
  the docs that describe current behavior.
- Status docs record actual state, not intended state. Delete or re-mark an entry the moment its
  claim stops being true.
- Do not restate the spec in a doc — link it. Duplication is how docs go stale silently.

### Protected foundations
- Never patch a vendored component, framework file, or third-party internals to make a feature
  work. Project logic goes in project layers.
- If a foundation file seems to need editing, the real problem is upstream of it — say so instead
  of working around it.

### Git and review
- One logical change per commit; conventional prefix.
- Long-lived branch: pull/rebase the trunk before pushing; `--force-with-lease` only.
- Never skip hooks. A failing hook is a finding, not an obstacle.
- Review bots are leads, not evidence. Use the PR-babysitting skill for the loop and the
  PR-comment skill for anything written on the owner's behalf.

---

## This repo — appendix

### Read order before implementing
`RULES.md` → `AGENTS.md` → `context/project-overview.md` → `context/architecture-context.md` →
`context/ui-context.md` → `context/code-standards.md` → `context/progress-tracker.md`.
Unbuilt design lives in `docs/target-state.md`; treat it as requirements, never as description.

### Commands
| Need | Command |
|------|---------|
| Dev server | `pnpm dev` |
| Tests | `pnpm test` (Vitest; `pnpm test -- <path>` for one file) |
| Types | `pnpm typecheck` (runs `next typegen` first) |
| Lint | `pnpm lint` |
| Build | `pnpm build` |
| Migrations | `pnpm db:migrate` |
| Seed demo data | `pnpm db:seed` |
| Demo user | `pnpm db:demo-user` |
| Queue worker | `pnpm worker` (manual only — no production host yet) |

`pnpm` only (`packageManager` is pinned); Node ≥ 24. npm/yarn produce a lockfile this repo does not use.

### Where logic goes
`lib/agents` identity/role only · `lib/db` persistence + the RLS-backed tenant gate ·
`lib/dashboard` read models shared by routes · `lib/queue` queue + worker · `lib/cache` tag ownership ·
`lib/exports` CSV/PDF · `app/api` thin handlers.
Protected: `components/ui/*` (shadcn) and `lib/supabase/*` (client construction).

### Next.js 16 fork
This is not the Next you may remember. Read the matching guide in `node_modules/next/dist/docs/`
before touching a framework API: `proxy.ts` replaces `middleware.ts`, route handlers take a
`RouteContext<"/path">` second arg, `revalidateTag(tag, profile)` is two-argument, and
`next typegen` generates route types. Do not hand-write a `Middleware` export.

### Schema changes
Never edit an applied migration — add a timestamped one. Every new table needs RLS enabled with a
policy matching the role/tenant model in `context/architecture-context.md`, in the same change.

### Data today
The dashboard's rows come from `scripts/seed.mjs`. `pnpm worker` consumes the queue and returns
`mock_completed`; it writes nothing. Anything you observe about "sync" is therefore not evidence
about sync.

### Agent development rules
- Build each agent in isolation before wiring it into the queue; mock the external API responses.
- Verify partial failure: kill one mock source, confirm the others still write.
- Verify the circuit breaker fires after 5 consecutive failures and that a paused client is alerted.
- Verify `is_stale` flips when a sync misses the 24-hour window — the banner depends on it.

### Before moving to the next unit
1. The unit works end to end inside the scope you stated in step 2 of the loop.
2. No invariant in `context/architecture-context.md` was violated (read the list; #4 tenant
   isolation and #12 the static dashboard shell are the ones that break silently).
3. `context/progress-tracker.md` reflects what actually happened.
4. `pnpm test && pnpm typecheck && pnpm lint && pnpm build` are green.
5. No orphaned dev server, worker, or background process left running.
