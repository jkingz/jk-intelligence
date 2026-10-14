---
name: git-workflow
description: Commit conventions, push discipline for this repo's dev branch, PR shape, and the review gate.
---

# Git Workflow

## Commits

Conventional prefixes: `feat:` `fix:` `style:` `perf:` `refactor:` `chore:` `docs:` `test:` `build:`
`ci:`. One logical change per commit. Subject says **why** — a reader of `git log` alone should
understand what defect existed before. Where a change drops or rewrites documented lines, the body
names them, and that disclosure outranks brevity. No co-authors, no
"generated with", no boilerplate. Check `git status` before `git add` — `.env*` is gitignored and a
real env value must never land in a commit.

## Push discipline

Commit, push, open or merge a PR **only when asked**. Being asked is not clearance to push a red or
unverified tree: `AGENTS.md` § STANDING RULES 13's push gate decides, and its three outcomes are
green, waived (owner's call, per push, named in the reply and the PR body) and red — red stops.
Before pushing to `dev`: `git pull` from `origin main`, merge, resolve conflicts, then commit and
push — never push to `dev` without that pull. No `--no-verify`, no skipped hooks, no bypassed
signing; a failing hook is a finding to fix at the cause. Never force-push a shared branch, and
never `git reset --hard` / `clean -f` / `checkout --` over work you did not write. Destructive or
externally visible actions need explicit authorization every time, not once-and-forever.

## Pull requests

Title `<type>(<scope>): <imperative summary>`. Body: what changed (2–3 bullets) · how it was
verified (each gate plus any live check) · what was not covered (live credentials, hosted-project
applies, Vercel-specific behavior). One PR per unit; draft until green; request review after the
suite passes. Rebase-merge onto `main` — history is linear.

Skip the PR for tiny doc-only or rename-only changes: commit directly with a conventional message.

## Review gate

`AGENTS.md § STANDING RULES 13`, all of it, in that order — CI runs the same commands. Follow
`/babysitting-a-pr` when watching a thread, and `/leaving-pr-comment` for anything written on the
owner's behalf, including the mandatory first-line AI-authorship disclaimer. A finding you decline
gets a written decline, then the thread is resolved.
