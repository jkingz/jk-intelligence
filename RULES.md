# Project RULES — read FIRST, before any task

These are standing constraints for future development in this repo. Read this file first every time before doing a taskable request)Skip nothing; they apply to every change.

## 1. Be very concise
- Keep responses short. Sacrifice grammar for the sake of concision.
- No preamble, no "here is what I did" essays. State the change + the result + the one thing you need from me.

## 2. Servers / ports
- Restart or kill any running server or port **only during implementation of the current running task**.
- Kill stale processes on ports the app uses before starting; don't leave a server running after the task is done unless the task says so.
- Never leave orphaned dev servers/queues/workers running at the end of a session.

## 3. Remove unused project-related stuff
- Delete unused project-related files, variables, CSS, and JavaScript as you go.
- Remove dead imports, stale env vars, unused tokens, orphaned components, and abandoned code paths.
- If you remove something because it's now unused, say so in the summary.
- Don't delete things that are still in use — verify before removing.

## 4. Git pull-before-push
- Before every `git push` to `dev`, first `git pull` from `origin main` (merge into the local branch), then resolve any conflicts, then commit/push.
- Never push to `dev` without first pulling `origin main`.
