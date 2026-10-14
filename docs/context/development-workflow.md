# Development Workflow — Portable core

1. Read what governs the change (`AGENTS.md` § STANDING RULES, then `AGENTS.md` § Reference map and the `docs/context/` files it names)
2. State scope in one sentence
3. Implement the smallest verifiable increment
4. Verify with commands, not claims
5. Update the docs the change made untrue
6. Report what changed, what was verified, what is unknown

### Scoping
- One feature unit or one agent at a time.
- Split when a step crosses boundaries: UI + sync agent, schema + API route, cache + auth,
  queue/cron + dashboard, or anything whose behavior is not written down.
- If end-to-end verification of a step is not quick, the scope is too broad — split it.
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

## Development Workflow — Project appendix

This appendix and § Development Workflow — Portable core both prescribe; where they disagree, this
appendix wins for this repo.

### Read order before implementing
`AGENTS.md` § STANDING RULES → `AGENTS.md` § Reference map → the `docs/context/` files it names.
Unbuilt design lives in `docs/target-state/README.md` § TARGET STATE; treat it as requirements, never as description.

### Commands
| Need | Command |
|------|---------|
| Dev server | `pnpm dev` |
| Tests | `pnpm test` (Vitest unit project) · `pnpm test:all` (+ integration) · `pnpm test:e2e` · narrow with `pnpm test <path>`, not `pnpm test -- <path>` |
| Types | `pnpm typecheck` (runs `next typegen` first) |
| Lint | `pnpm lint` |
| Build | `pnpm build` |
| Migrations | `pnpm db:migrate` |
| Seed demo data | `pnpm db:seed` |
| Seed connection placeholders | `pnpm db:seed-connections` — placeholder-only `api_credentials` rows (`vault:` reference, never a key), idempotent via `on conflict (client_id, source) do nothing`; needs the same `SUPABASE_DB_URL` redirection as `db:seed` |
| Demo user | `pnpm db:demo-user` |
| Queue worker | `pnpm worker` (manual only — no production host yet) |

`pnpm` only, Node ≥ 24 — `AGENTS.md` § STANDING RULES 11 is the authority, including why `package-lock.json` was
deleted. npm/yarn produce a lockfile this repo does not use.

### Where logic goes
`lib/agents` identity/role only · `lib/db` persistence + the RLS-backed tenant gate ·
`lib/dashboard` read models shared by routes · `lib/connections` the connection-state join (derives
no ownership) · `lib/navigation` the rail's destination list · `lib/queue` queue + worker ·
`lib/cache` tag ownership · `lib/exports` CSV/PDF · `app/api` thin handlers.
Protected: `components/ui/*` (shadcn) and `lib/supabase/*` (client construction).

### Next.js 16 fork
This is not the Next you may remember. Read the matching guide in `node_modules/next/dist/docs/`
before touching a framework API: `proxy.ts` replaces `middleware.ts`, route handlers take a
`RouteContext<"/path">` second arg, `revalidateTag(tag, profile)` is two-argument, and
`next typegen` generates route types. Do not hand-write a `Middleware` export.

### Schema changes
Never edit an applied migration — add a timestamped one. Every new table needs RLS enabled with a
policy matching the role/tenant model in `docs/context/architecture-context.md` § Architecture Context, in the same change.

### Data today
The dashboard's rows come from `scripts/seed.mjs`, and the `api_credentials` rows `/connections`
renders from `scripts/seed-connections.mjs` — both are placeholders; nothing is fetched.
`pnpm worker` consumes the queue and returns `mock_completed`; it writes nothing. Anything you
observe about "sync" is therefore not evidence about sync.

### Agent development rules
- Build each agent in isolation before wiring it into the queue; mock the external API responses.
- Verify partial failure: kill one mock source, confirm the others still write.
- Verify the circuit breaker fires after 5 consecutive failures and that a paused client is alerted.
- Verify `is_stale` flips when a sync misses the 24-hour window — the banner depends on it.

### Before moving to the next unit
1. The unit works end to end inside the scope you stated in step 2 of the loop.
2. No invariant in `docs/context/architecture-context.md` § Architecture Context was violated (read the list; #4 tenant
   isolation and #12 the static dashboard shell are the ones that break silently).
3. `docs/progress-tracker.md` reflects what actually happened.
4. The four-gate chain in `AGENTS.md` § STANDING RULES 13 is green — that rule is the authority on which gates,
   and it also names the integration and e2e tiers this checklist used to omit.
5. Nothing you started is still running — `AGENTS.md` § STANDING RULES 5.

