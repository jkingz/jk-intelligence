---
name: development-workflow
description: The per-unit work loop — read order, scope statement, smallest increment, verification, doc repair, report.
---

# Development Workflow

## The loop, per unit of work

1. Read what governs the change: `AGENTS.md` § STANDING RULES, then `AGENTS.md` § Reference map and
   the docs file it names for the module being touched.
2. Say the scope in one sentence — what changes, and what explicitly does not.
3. Implement the smallest increment that can be verified alone.
4. Verify with `/verification-gates`. Never with a claim.
5. Update the docs the change made untrue, in the same change.
6. Report: what changed, what was verified, what is still unknown.

## Scoping

The request is the scope. An adjacent improvement is a finding to report in one line of the reply,
not work to do. No renames, dependency swaps, or formatting of untouched files. If end-to-end
verification of a step is not quick, the step is too broad — split it where the boundaries cross
(UI + sync, schema + API, cache + auth, queue/cron + dashboard).

## Requirements

Do not invent behavior that is not in `AGENTS.md` or the docs files its § Reference map names.
Ambiguous → resolve it in the relevant section, then implement. Missing → record it as an open
question in `specs/` and stop that branch of work.
A guessed constant, threshold, or policy is a requirement you invented: label it or drop it.

## Docs and truth

Code is the source of truth; where a doc and the code disagree, the doc is the defect and you fix it
in the same change. Unbuilt intent lives in `docs/target-state/README.md` § TARGET STATE and may never
be cited as current behavior. No rotting literals — quote command output instead of typing a count.

## Before moving to the next unit

The unit works end to end inside the scope stated at step 2; no invariant in
`docs/context/architecture-context.md` § Invariants was violated (#4 tenant isolation and #12 the
static dashboard shell are the ones that break silently); the implemented surface in
`docs/architecture/README.md` § SERVICE ARCHITECTURE describes what now exists;
`docs/progress-tracker.md` reflects what actually
happened; the full gate chain is green; no orphaned dev server, worker or background process.

- `AGENTS.md` § STANDING RULES and
  `docs/context/development-workflow.md` § Development Workflow — Project appendix hold the
  contract.
