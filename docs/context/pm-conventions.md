# PM Conventions

Tracked, reviewable work in this repo follows these conventions. Small tasks (< 15 lines of
real change) may be a single commit; anything larger is a PR.

### Commits

- Prefix with a conventional type: `feat:` `fix:` `style:` `perf:` `refactor:` `chore:`
  `docs:` `test:` `build:` `ci:`.
- No sweeping mixed commits ("misc cleanup + feature") — "one logical change per commit" is stated in
  § Development Workflow — Portable core.
- No co-authors, no "generated with", no body boilerplate.
- Never commit secrets / rotated tokens / real env values (gitignored, but check `git status`
  before `git add`).

### PRs

- Title: `<type>(<scope>): <imperative summary>` — e.g. `feat(auth): add staff role access`.
- Body: **what changed** (2-3 bullets), **how it was verified** (tests/typecheck/lint/build,
  plus any live check), and **what wasn't covered** (Vercel mirroring, live OAuth, etc.).
- One PR per feature/unit — follow the scoping rules in § STANDING RULES (standing constraints)
  and § Development Workflow. No grab-bag PRs.
- Draft until green; request review after the suite passes.
- Rebase-merge onto `main`; history is linear, so rebase before pushing.

**Skip when not needed:** tiny doc-only or rename-only changes don't need a PR; commit
directly to `main` with a conventional message.

