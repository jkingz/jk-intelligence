<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# STANDING RULES — Read first, before any task

Constraints that apply to every change. Read these in full before every taskable request. Skip nothing.

Rules 1–10 are the **portable core** — they hold in every repo this workspace touches, and belong in any new project's `AGENTS.md` § STANDING RULES verbatim. Rules 11–17 are **this repo's** appendix.

## Portable core — Rules 1–10

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
- Being asked is permission to push, not permission to push a red or unverified tree. The project's own rules say which commands are the gate; a tier that could not run is named and waived by the owner, never reported as green.
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
- State assumptions plus the step that would verify them. Missing requirement → record it as an open
  question, stop the branch of work that depends on it, and continue with the rest.
- When implementation and docs disagree, code is truth and the doc is a defect: fix the doc in the same change.

## Project-specific rules — Rules 11–17

### 11. Package manager and runtime
- pnpm only (`pnpm-lock.yaml`). `package-lock.json` was deleted deliberately — do not regenerate it with npm.
- Node `>=24` per `package.json` engines; patched dependency `next-themes` comes from `patches/`.

### 12. Next.js 16 is a fork of what you remember
- Read the matching guide in `node_modules/next/dist/docs/` before touching framework APIs (`proxy.ts` not `middleware.ts`, `RouteContext`, two-arg `revalidateTag`).
- `next dev` manages only the marker block at the top of this file. § EDITING THIS FILE owns the
  mechanism, what it overwrites, and why committing the block with your work keeps the tree clean.

### 13. Verification gates
- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` must be green before reporting work complete; CI (`.github/workflows/ci.yml`) runs these four plus `pnpm test:e2e` (public tier only).
- Tests live in `tests/<feature>/<tier>/` — the feature folders and what each one owns are the table in `docs/architecture/README.md` § SERVICE ARCHITECTURE → Verification; tiers `unit`, `integration`, `e2e`. Name the file `<sut>.test.ts` (unit/integration) or `<flow>.spec.ts` (e2e); import the **subject under test** through `@/`, never relatively — a `./` specifier can silently resolve to a neighbouring file of the same name. Shared helpers under `tests/helpers/` are the one exception and may be imported relatively.
- Unit tests mock at the boundary (`@/lib/agents/...`, `@/lib/db/repository`) — never inside business logic, and never make a real network or DB call. That last clause is **unit-tier only**: the integration tier exists precisely to put a real Postgres behind `canAccessClient`.
- `pnpm test` is the **unit project**, not the whole suite. The `integration` project is `tests/*/integration/**/*.test.ts`, run against the local stack: the two live-RLS files `tests/tenant-isolation/integration/rls-gate.test.ts` (`clients`) and `credentials-visibility.test.ts` (`api_credentials`), plus `tests/admin/integration/provisioning.test.ts` (admin `security definer` RPCs). All three gate on `describe.skipIf(!hasTestDb)`, where `tests/helpers/db.ts` derives `hasTestDb` from `TEST_SUPABASE_URL`, so a green tier can mean *nothing ran* — read the passed/skipped counts from the run, not the exit code. E2E is a separate runner. Narrow with `pnpm test dashboard`, never `pnpm test -- dashboard` — the latter silently runs everything.
- **The push gate** — `pnpm test:all` and `pnpm test:e2e`, on top of the four-chain above, which only
  gates *reporting*. It has three outcomes and exactly two are pushable:
  - **green** — every tier ran and passed, counts quoted from the run.
  - **waived** — the tier's own dependency is absent, so it cannot run here: no local stack, no
    `.env.test` names, no browser credentials. Waiving is the owner's decision, per push, never
    once-and-forever; the reply and the PR body both name the tier and the reason, in the
    § VERIFICATION STANDARDS phrasing.
  - **red** — the tier reached its dependency and an assertion failed. Stops: nothing is pushed, no
    PR is opened, and the cause is fixed before retrying.
- Telling waived from red is evidence, not mood. `skipIf` keys off `TEST_SUPABASE_URL` being *set*,
  not reachable, so a stack-less integration run reports **failures**, not skips — every file in the
  tier dies with the same connection error (`fetch failed`, `ECONNREFUSED`) before any assertion
  runs. A file that fails on a mismatch while its neighbours pass is red. The exit code cannot tell
  the three outcomes apart; the output can.
- Route handlers get a `<name>-route.test.ts` covering 401 / 403 / 400 / 503 and the no-data-leaked-before-auth path.

### 14. Read order
§ STANDING RULES → § Reference map. For architectural decisions, read the `docs/context/` files
in map order (Project Overview → Architecture Context → UI Context → Code Standards → Development
Workflow → PM Conventions). What exists: `docs/architecture/README.md` § SERVICE ARCHITECTURE;
what does not: `docs/target-state/README.md` § TARGET STATE. Per-unit feature specs live in
`specs/`. The rolling log at `docs/progress-tracker.md` is history, not required reading:
`docs/context/project-overview.md` § Project Overview → Status and § Open product questions decide
what is current.

The `§` marker these citations are written in — here and in every other file in this repo — is
defined in § Notation.

### 15. Tenant isolation is RLS's job
- Client-ownership is decided only by `canAccessClient` / `listAccessibleClients` in `lib/db/repository.ts`. No route or helper may re-implement that rule in TypeScript.
- `docs/architecture/README.md` § SERVICE ARCHITECTURE describes implemented code only; anything not built lives in `docs/target-state/README.md` § TARGET STATE.
  Never cite that section as current behavior, and check a module exists before assuming it does
  (`lib/agents/` holds only `authAgent`).

### 16. Supabase
- Schema changes are new timestamped files in `supabase/migrations/`, applied with `pnpm db:migrate`; never edit an applied migration.
- Never run a `db:*` script bare on this checkout — `db:migrate`, `db:seed` and `db:seed-connections` (whose `--reset` deletes rows) all read `SUPABASE_DB_URL`, and `.env` here targets hosted production with no `.env.local` to shadow it. Redirect the URL at the intended database first.
- Every table gets RLS matching the role model. `metrics_snapshots` is append-only. Provider key material and `credential_reference` never appear in a response or a log line; `api_credentials` status columns (`client_id`, `source`, `created_at`) may.
- Local runs need `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`; server-side also `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, and the private `DEMO_EMAIL`/`DEMO_PASSWORD` (server-read, prop-fed — never `NEXT_PUBLIC_*`, the login page would ship the password in the bundle). `.env.example` carries every name with placeholders; `.env.test` carries the `TEST_*` integration-tier names. Copy names, never values.
- CI needs only the two `NEXT_PUBLIC_*` values; `.github/workflows/ci.yml` sets non-secret placeholders so `pnpm build` can prerender.

### 17. UI conventions
- `next/image` `Image`, never raw `<img>`. SVG sources only if self-authored and script-free.
- shadcn/`components/ui/*` and `lib/supabase/*` are protected foundations: don't edit to make a feature pass.

# Reference map — where the detail lives

Rules 1–17 are binding. Everything below them routes through this table; a `§` in a docs file
names its own file per § Notation. Read order (rule 14): the rules, then this map,
then the file your task points at.

| Concern | File | Owns |
| --- | --- | --- |
| What is built vs not, goals, open product questions | `docs/context/project-overview.md` | § Project Overview |
| Stack, system boundaries, storage model, auth/tenancy, invariants | `docs/context/architecture-context.md` | § Architecture Context |
| Theme, tokens, typography, dashboard/UI patterns, layout, motion | `docs/context/ui-context.md` | § UI Context |
| General, TypeScript, Next.js, React, styling, API routes, data, file organization, testing conventions | `docs/context/code-standards.md` | § Code Standards |
| The per-unit loop, scoping, verification order, commands table | `docs/context/development-workflow.md` | § Development Workflow |
| Commit and PR conventions | `docs/context/pm-conventions.md` | § PM Conventions |
| Implemented surface: request path, tenant gate, HTTP surface, queue/cron, pages & caching, verification, repo skills, feature specs | `docs/architecture/README.md` | § SERVICE ARCHITECTURE, § FEATURE SPECS |
| Design intent for what is NOT built — never cite as current behavior | `docs/target-state/README.md` | § TARGET STATE |

- `specs/` holds one file per deliverable unit (`specs/00-template.md`); `docs/superpowers/` holds
  dated design docs and plans. Dated records keep their old citations as history.
- A section describing a surface changes in the same commit that alters that surface —
  § EDITING THIS FILE now governs `AGENTS.md` and the three docs homes.

# VERIFICATION STANDARDS — Quality guardrails

A sentence earns its place in this file only if its author read the thing this session. These are the
failure modes no inline correction has closed yet.

| Bad line | Why it is wrong | Good line |
| --- | --- | --- |
| "60 tests passing." | A count rots the day someone adds a test — and `RULES`-era docs here carried exactly that kind of stale number. | Run the command, quote its output in the reply, type nothing into the doc. |
| "Integration tests pass." | The tier can collect nothing and still exit 0. § STANDING RULES 13 owns the file list and the `skipIf` mechanism — this row adds no rule, only the phrasing. | "integration tier: N passed, 0 skipped" — or say it skipped for want of `TEST_*` names. |
| "Build passes locally and in CI." | The build once fetched Geist from `fonts.googleapis.com` at build time, which a sealed runner cannot reach; the first CI run was red on it and the fix was to vendor the fonts. | Name the probe: `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build`. It passes here because `app/fonts/` and `lib/exports/fonts/` are vendored. |

# EDITING THIS FILE

`next dev` writes one thing: the text between `<!-- BEGIN:nextjs-agent-rules -->` and
`<!-- END:nextjs-agent-rules -->`. `upsertAgentRulesBlock()` in
`node_modules/next/dist/server/lib/generate-agent-files.js` (Next 16.3.5) replaces that span and
nothing else, so everything below it — `# STANDING RULES`, `# Reference map`, `# VERIFICATION
STANDARDS` and the three docs homes — is hand-maintained and never arrives by generation. Commit the marker block with your work rather than deleting it.

Any section that describes a surface changes in the same commit that alters that surface — a doc that
waits for a later cleanup commit is describing a state that no longer exists in the meantime.

## Notation

`§` is this repo's section marker, and it is used well outside this file — in `README.md`, `specs/`,
`docs/conventions/`, the repo skills, code comments and `.github/workflows/ci.yml`. It is a citation,
not stray punctuation, so it is never a cleanup target. Five forms:

| Form | Reads as | Live example |
| --- | --- | --- |
| `` `FILE.md` § Heading `` | that heading in that named file | `` `docs/progress-tracker.md` § Completed `` |
| `§ Heading`, no file named | that heading in the file being read | `§ Notation`, below |
| `§ A → B` | subsection `B` inside section `A` | `§ Project Overview → Status` |
| `§ A <n>` | numbered item `<n>` of section `A` | `§ STANDING RULES 13` |
| `<doc> §<n>` | numbered section `<n>` of a named spec or design doc | `Spec §6`, `Planned agents §1` |

Two rules follow from the second row:

- A bare `§` means *the file you are reading*. Inside this file or a docs home, cite its own
  sections bare — never prefixed with that file's name. Completeness check 6 counts the prefixed form and expects exactly
  one hit: the portable-core note at the top of § STANDING RULES, which is talking about *another*
  project's copy. A citation that crosses files names the file, or it is unreadable from anywhere
  else.
- A `§` left pointing at a renamed or deleted heading is a dead pointer, fixed in the commit that
  moved it — **except inside a dated record.** `docs/progress-tracker.md`'s dated entries, the plans
  and specs under `docs/superpowers/`, and the applied migrations in `supabase/migrations/` are
  history: their citations stay exactly as written even when they name a file that no longer exists
  (`RULES.md`, `context/*`), because repairing a record is falsification. Rule 16 states the
  migration half of that on its own.

## When each section changes
- **STANDING RULES** — when a rule about *how* work gets done changes. Not when a feature ships.
- **`docs/context/`** — Project Overview / Architecture Context when a decision is made, before the
  code exists; UI Context / Code Standards / Development Workflow / PM Conventions when the practice
  they prescribe changes, not when a feature ships.
- **§ Reference map** — when a docs home is added, renamed or moved; this list names it.
- **`docs/architecture/README.md` § SERVICE ARCHITECTURE** — implemented code only. When something
  becomes true, move it out of `docs/target-state/README.md` in the same commit that made it true.
- **`docs/architecture/README.md` § Repo skills** — when a skill is added, removed or re-linked. Its counts are
  a dated filesystem measurement, so re-measure with `readlink` and `git ls-files -s` rather than
  editing a number.
- **`docs/target-state/README.md` § TARGET STATE** — whenever intent outpaces implementation. Never
  cite it as current behavior.
- **`docs/architecture/README.md` § FEATURE SPECS** — when `specs/` gains or loses a numbered file,
  or the split with `docs/superpowers/specs/` changes.
- **VERIFICATION STANDARDS** — when an inline correction closes a failure mode: delete its row rather
  than leaving a second authority.
- **EDITING THIS FILE** — when a section is added, renamed or moved, this list names it.
- **specs/** — one file per deliverable unit. `specs/00-template.md`.

## Completeness — the checks that work
No slot grep. The template's `grep -n '<[a-zA-Z_/]' AGENTS.md` cannot run against a filled file:
`<clientId>`, `<CRON_SECRET>` and `<type>(<scope>)` are real text here, so it reports noise forever
and trains people to ignore a gate. Every check below therefore has a stated expected result on the
file as it stands — a check whose expected output is "some noise you learn to skip" is the same
defect wearing a different name.

1. Every concern in § Reference map resolves to a file that exists:
   `sed -n '/^# Reference map/,/^# VERIFICATION/p' AGENTS.md | grep -oE '`docs/[^`]*`' | tr -d '`' | sort -u | while read -r f; do [ -e "$f" ] || echo "MISSING $f"; done` — expected: no output. The heading names
   in that table's third column are confirmed by check 1's sibling, the heading census: run
   `grep -n "^# \|^## "` over `AGENTS.md` and each docs home and match the rows by eye.
2. Every repo-rooted path cited in `AGENTS.md` or the docs homes resolves. Run:

   ```bash
   grep -ohE '(app|components|lib|tests|types|specs|docs|scripts|supabase|patches|\.github)/[]A-Za-z0-9_./{}()[-]*\.(ts|tsx|css|md|sql|json|mjs|ya?ml)' AGENTS.md docs/context/*.md docs/architecture/README.md docs/target-state/README.md \
     | sort -u \
     | while read -r p; do git ls-files --error-unmatch "$p" >/dev/null 2>&1 || echo "$p"; done
   ```

   Expected: exactly the five paths cited in order to say they do *not* exist —
   `lib/admin/http.ts` and `lib/agents/syncAgent.ts` / `transformAgent.ts` / `cacheAgent.ts` /
   `insightsAgent.ts` (now living in the docs homes). A sixth line is a dead pointer. Bare basenames (`guard.ts`) and
   `node_modules/…` paths are outside this command's reach; check those by opening the file, because a
   whole-file grep over them produces the noise this section refuses to generate.
3. Every command cited here or in the docs homes is real. `pnpm run` lists the scripts, but a `pnpm <verb>` form outside
   that list is not covered by it. Enumerate those with `grep -ohE 'pnpm (exec|dlx|patch|patch-commit|add|install|remove)'` run over
   `AGENTS.md docs/context/*.md docs/architecture/README.md docs/target-state/README.md` | sort -u — expected
   today: `pnpm exec`, `pnpm patch`, `pnpm patch-commit`. A fourth line means a new form was cited and
   needs confirming with `command -v <tool>` or the tool's own `--help`; so does any bare tool
   invocation this file cites, such as `supabase start`.
4. No census is typed in as a state claim — a total count of tests, files, lines or routes rots the
   day the thing it counts changes. Quote the command output in the reply instead. Not censuses: a
   number inside an example of a report line; a version copied from the installed package; a
   measurement labelled with the date it was taken, kept as the evidence for a marking or an open
   question; a count printed beside the command that derives it, as `docs/architecture/README.md` § HTTP surface prints
   `find app/api -name route.ts` next to its file total; and a count of things the same section
   enumerates, where the reader can see the members instead of trusting the total. The rule covers the docs homes.
5. No raw-token utility outside the sentence that forbids it:
   `grep -n "\bbg-base\b" AGENTS.md docs/context/ui-context.md docs/context/code-standards.md | grep -v -- "--bg-base"` prints only `docs/context/code-standards.md` § Styling's "`bg-base`,
   `text-copy-primary`, `text-brand` generate nothing and fail silently" line. The code side is
   `grep -rn "bg-base" app components`, whose only hits are `--bg-base` declarations.
6. No self-citation by filename — a section of the file being read is cited bare (`§ Notation`),
   never prefixed with that file's own name. Run: ``git grep -c 'AGENTS\.md` §' AGENTS.md``. Expected: `1`,
   the portable-core note at the top of § STANDING RULES, which names *another* project's copy. A
   second hit is a citation that should have been written bare. The `\.` in the pattern is what keeps
   this check's own text from matching itself.
