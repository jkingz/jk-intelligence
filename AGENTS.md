<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# STANDING RULES — Read first, before any task

Constraints that apply to every change. Read these in full before every taskable request. Skip nothing.

Rules 1–10 are the **portable core**. They hold in every repo this workspace touches and belong in any new project's `AGENTS.md` § STANDING RULES verbatim. Project-specific rules 11–17 live in `docs/conventions/project-rules.md` § PROJECT RULES. Read that file in full before every taskable request, as you do this one.

## Portable core — Rules 1–10

### 1. Be very concise
- Keep responses short. Sacrifice grammar for the sake of concision.
- No preamble, no "here is what I did" essays. State the change + the result + the one thing you need from me.

### 2. No "done" without a command behind it
- Every claim of completion names the command run and what it printed (`pnpm test` → `<N> passed`; `curl` → the status code).
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

# Reference map — where the detail lives

Rules 1–10 are binding here. Project rules 11–17 are binding too, in `docs/conventions/project-rules.md` § PROJECT RULES, and that file's rule 14 is the read order. Everything below routes through this table; a `§` in a docs file names its own file per `docs/maintenance/README.md` § Notation.

| Concern | File | Owns |
| --- | --- | --- |
| Project rules 11–17: package manager, Next.js fork, gates, read order, tenant isolation, Supabase, UI | `docs/conventions/project-rules.md` | § PROJECT RULES |
| What is built vs not, goals, open product questions | `docs/context/project-overview.md` | § Project Overview |
| Stack, system boundaries, storage model, auth/tenancy, invariants | `docs/context/architecture-context.md` | § Architecture Context |
| Theme, tokens, typography, dashboard/UI patterns, layout, motion | `docs/context/ui-context.md` | § UI Context |
| General, TypeScript, Next.js, React, styling, API routes, data, file organization, testing conventions | `docs/context/code-standards.md` | § Code Standards |
| The per-unit loop, scoping, verification order, commands table | `docs/context/development-workflow.md` | § Development Workflow |
| Commit and PR conventions | `docs/context/pm-conventions.md` | § PM Conventions |
| Feature-folder layout and wiring for feature components | `docs/conventions/feature-components.md` | § Feature Folders, § Wiring Rules |
| Implemented surface: request path, tenant gate, HTTP surface, queue/cron, pages & caching, verification, repo skills, feature specs | `docs/architecture/README.md` | § SERVICE ARCHITECTURE, § FEATURE SPECS |
| Design intent for what is NOT built — never cite as current behavior | `docs/target-state/README.md` | § TARGET STATE |
| The `§` notation, which section changes when, the guardrails on a doc claim, the checks that keep this map honest | `docs/maintenance/README.md` | § EDITING THE AGENT DOCS, § VERIFICATION STANDARDS |

- `specs/` holds one file per deliverable unit (`specs/00-template.md`); `docs/superpowers/` holds
  dated design docs and plans. Dated records keep their old citations as history.
- The rules for editing these files — what changes when, and the checks that prove it — live in
  `docs/maintenance/README.md`, including the same-commit rule that applies to this table.
