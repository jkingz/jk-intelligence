# PR / Commit Conventions

Tracked, reviewable work in this repo follows these conventions. Small tasks (< 15 lines of
real change) may be a single commit; anything larger is a PR.

## Commits

- Prefix with a conventional type: `feat:` `fix:` `style:` `perf:` `refactor:` `chore:`
  `docs:` `test:` `build:` `ci:`.
- One logical change per commit. No sweeping mixed commits ("misc cleanup + feature").
- No co-authors, no "generated with", no body boilerplate.
- Never commit secrets / rotated tokens / real env values (gitignored, but check `git status`
  before `git add`).
- Don't commit or push unless asked.

## PRs

- Title: `<type>(<scope>): <imperative summary>` — e.g. `feat(auth): add staff role access`.
- Body: **what changed** (2-3 bullets), **how it was verified** (tests/typecheck/lint/build,
  plus any live check), and **what wasn't covered** (Vercel mirroring, live OAuth, etc.).
- One PR per feature/unit — follow the scoping rules in `RULES.md` (standing constraints)
  and `context/development-workflow.md`. No grab-bag PRs.
- Draft until green; request review after the suite passes.
- Rebase-merge onto `main`; history is linear, so rebase before pushing.

## Review gate (the change must be green to merge)

- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` — all four, in that order. No test
  count is quoted here on purpose: read the suite output, not this file.
- Add/update tests for behavior changed, per `context/code-standards.md` (Testing) and the
  verification loop in `context/development-workflow.md`.

**Skip when not needed:** tiny doc-only or rename-only changes don't need a PR; commit
directly to `main` with a conventional message.
