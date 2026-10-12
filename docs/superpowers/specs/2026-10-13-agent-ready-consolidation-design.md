# Agent-ready consolidation — design

Date: 2026-10-13 · Status: approved in chat, awaiting written review
Scope: documentation and repo-skill restructure. **No application behavior changes.**
Source of the idea: `/Users/jkingz/Downloads/JKINGZ_FILES/_projects/agent-ready-template`

## What the template is

16 files, all markdown plus one CI workflow — no application code. One 518-line `AGENTS.md`
instruction layer with unfilled `<SLOT>`s, four flat process skills, a CI template, and reference
READMEs for `context/`, `specs/` and `tests/`.

Its `VERIFICATION STANDARDS` examples are this repo's own past doc defects verbatim
(`syncAgent`/`transformAgent`/`cacheAgent`/`insightsAgent`, the `metrics_snapshots.metrics` JSONB
array, `users.email`, `is_stale`, `bg-base`, the `.agents/skills` hardlink claim). The template was
distilled from these docs; adopting it wholesale would be a round trip. What this design ports is
the **structure and the mechanisms this repo lacks**, not the prose.

Already present here, unchanged in substance: `RULES.md` = STANDING RULES §1–17 (same numbering,
richer wording) · `AGENTS.md` § SERVICE ARCHITECTURE = the template's · `docs/target-state.md` =
TARGET STATE · `docs/superpowers/specs/` = dated design docs · `tests/<feature>/<tier>/` = the
template's test layout · `.github/workflows/ci.yml` = the filled-in template CI.

## Decisions taken

1. **Full consolidation.** `RULES.md` and the six guidance files in `context/` fold into a single
   `AGENTS.md` and are deleted. No pointer stubs.
2. **Tracker compresses, log demotes.** Live status folds into `AGENTS.md`; the rolling log moves
   with `git mv` to `docs/progress-tracker.md` and leaves the read order.
3. `docs/target-state.md` folds into `AGENTS.md § TARGET STATE`, inline.
4. `context/feature-specs/` moves to `specs/` and gains `00-template.md`.
5. The template's four process skills are added, filled with this repo's real commands.
6. Execution is **Approach C**: one section per commit, source deleted in the same commit.

## Final tree

`AGENTS.md` (whole instruction layer) · `CLAUDE.md` unchanged (its content is `@AGENTS.md`) ·
`specs/00-template.md` + `specs/01..09-*.md` · `docs/progress-tracker.md` ·
`docs/{conventions,diagrams,pitches,screenshots,superpowers}` untouched ·
`.claude/skills/` + `.agents/skills/` · **no `RULES.md`, no `context/`**.

## `AGENTS.md` section budget

Measured with `wc -l` on the current files.

| Section | Source | Lines |
| --- | --- | --- |
| next-dev block | untouched, marker-delimited | 9 |
| STANDING RULES 1–17 | `RULES.md` (94) — project wording kept, template headings adopted | 95 |
| PROJECT OVERVIEW | `project-overview.md` (121), Features block moved out | 70 |
| ARCHITECTURE CONTEXT | `architecture-context.md` (155), its two HTTP-API sections moved out | 100 |
| UI CONTEXT | `ui-context.md` (290), near-verbatim | 240 |
| CODE STANDARDS | `code-standards.md` (274), Testing section replaced by a `/testing` pointer | 250 |
| DEVELOPMENT WORKFLOW — appendix | `development-workflow.md` repo half; its portable core drops | 60 |
| PM CONVENTIONS | `pm-conventions.md` (34); Review gate drops, it is RULES §13 | 25 |
| SERVICE ARCHITECTURE | today's hand-maintained half of `AGENTS.md` (233) | 200 |
| TARGET STATE | `target-state.md` (356) + `architecture-context.md:113-131`, deduped | 330 |
| VERIFICATION STANDARDS | new, anti-pattern table minus rows already absorbed | 20 |
| FEATURE SPECS + EDITING THIS FILE | new pointer sections | 30 |

Total ≈ **1,430 lines.** Consequence accepted at approval: `AGENTS.md` is auto-loaded into every
agent context, so ~290 lines of token tables and ~330 lines of unbuilt intent ride along on every
task. Lever if that proves too heavy later: compress token tables to utilities actually referenced
in JSX, and cut TARGET STATE to the agent contracts (~300 lines saved). Not done now — the token
tables are verified hex-for-hex against `globals.css` and compression risks losing that.

## Port rules

1. **Wording is preserved verbatim.** Only headings and cross-references are renamed.
2. **A line is dropped only when the destination already carries the same claim**, and every dropped
   line is listed in that commit's message.
3. **No new facts.** Anything not pointable at existing text or code goes to TARGET STATE labelled
   as intent.
4. Unbuilt content moves *out* of PROJECT OVERVIEW and ARCHITECTURE CONTEXT into TARGET STATE —
   notably `project-overview.md:42-85` Features: sync retry + circuit breaker, AI insight generation,
   admin manual sync trigger, Vault credential resolution.

## Forced fixes: claims the merge itself invalidates

Duplicating a contradiction into one file is worse than the current split, so these three are
corrected in the commit that ports their section. Each is verified against code on 2026-10-13, not
inferred.

- `context/project-overview.md:7` — the rail "lists Dashboard, Connections and Profile".
  `lib/navigation/destinations.ts` declares two entries and
  `tests/platform/unit/destinations.test.ts:43` asserts that exact array. Overview states two.
- `context/project-overview.md:11` — lists the admin panel under "Not built", while
  `AGENTS.md` documents `/admin`, the three `/api/admin/*` routes and `lib/admin/`. Moves to Built.
- `context/architecture-context.md:44-48` — five migrations, omitting
  `20261010000000_credential_reference_unselectable.sql` which `AGENTS.md` cites in the
  tenant-isolation section. One migration list, in SERVICE ARCHITECTURE.
- `AGENTS.md § EDITING THIS FILE` says the top block is regenerated by `next dev` "through the
  context-file list", and `RULES.md §12` says "The `## Standing Rules` / context block at the top of
  `AGENTS.md` is written by `next dev`". Both are false. `upsertAgentRulesBlock()` in
  `node_modules/next/dist/server/lib/generate-agent-files.js` (Next 16.3.5) replaces only the text
  between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->`, or appends the
  block when the markers are absent. Lines 10–29 of `AGENTS.md` are hand-maintained. → corrected in
  commit 1, and the same finding is what makes this design safe (see *The merge cannot be clobbered*).

## The merge cannot be clobbered

Verified on Next 16.3.5 before committing to this approach: `next dev` writes the marker-delimited
block and nothing else, so folding 1,400 lines of hand-maintained guidance into `AGENTS.md` creates
no collision with the framework, and the block itself stays byte-identical at every commit. The
gate check that `next dev` leaves the tree clean still runs once, after commit 9 — a `pnpm dev` boot
is allowed to report `unchanged` and nothing more.

## The four repo skills

Directory form, matching every existing entry: `.claude/skills/<name>/SKILL.md`. Mirrored into
`.agents/skills/<name>` as **symlinks**, the mechanism `feature-component` already uses — not
copies, not hardlinks. `AGENTS.md § Repo skills` names the mechanism per entry.

| Skill | Content | Source of truth |
| --- | --- | --- |
| `verification-gates` | the four-command chain, the report format, and "a green tier can mean nothing ran" — read passed/skipped counts, not the exit code | RULES §13 + template |
| `testing` | `tests/<feature>/<tier>/`, alias-only imports, boundary mocking, 401/403/400 + no-data-before-auth per route, two-tenant isolation fixture | RULES §13 + template |
| `development-workflow` | the six-step loop, scoping rules, requirements discipline, protected foundations | RULES §1–10 + template |
| `git-workflow` | commit prefixes, push discipline including **pull `origin main` before pushing to `dev`**, PR body contract, `/babysitting-a-pr` and `/leaving-pr-comment` handoff | RULES §7–8 + `pm-conventions.md` |

Every `<cmd>` slot in the template is replaced by a real command: `pnpm test`, `pnpm test:all`,
`pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`,
`pnpm db:seed-connections`, `pnpm db:demo-user`, `pnpm worker`, `pnpm exec supabase start`.

The `testing` skill carries one live probe rather than an assertion: pass a path that must match
nothing and require Vitest to report zero collected. If it runs the whole suite and exits 0, the
argument never reached the runner and the "run one file" claim is false.

## `specs/` and the two spec homes

`git mv context/feature-specs specs` keeps history; `specs/00-template.md` is the template's
`context/feature-specs/00-template.md` skeleton, whose `NN — <feature name>` header already matches
the nine files here. `docs/superpowers/specs/` keeps dated design docs from brainstorming;
`specs/` holds numbered feature specs. `AGENTS.md § FEATURE SPECS` states the difference in one
line so nobody files a design doc in the wrong place.

## Citation rewiring (the canonical enumeration; staging assigns its timing)

Live surfaces: `README.md` (lines 5, 6, 24, 53) · `lib/db/repository.ts:325` ·
`tests/tenant-isolation/integration/credentials-visibility.test.ts:23` ·
`tests/admin/integration/provisioning.test.ts:9` · `tests/fixtures/README.md:5` ·
`.claude/skills/feature-component/SKILL.md:18` · `docs/conventions/feature-components.md` ·
`AGENTS.md` (its 3 `target-state` references become `§ TARGET STATE`) · ~20 cross-refs inside the
moved files themselves.

Untouched by ruling: `docs/superpowers/plans/`, `docs/superpowers/specs/`, and `.superpowers/` (untracked
session scratch). A completed plan is a historical record; rewriting its citations falsifies it.

## Deliberately not ported

The template's slot health check `grep -n '<[a-zA-Z_/]' AGENTS.md`. It only works on an unfilled
file. This repo's live docs already contain legitimate angle brackets — `<clientId>`,
`<CRON_SECRET>`, `<type>(<scope>)`, the CSV filename scheme — so the probe returns dozens of false
hits and trains people to ignore a gate. Completeness is checked by the citation grep and by review.

## Commit staging and gates

Nine commits, in order:

1. STANDING RULES in, delete `RULES.md`
2. PROJECT OVERVIEW
3. ARCHITECTURE CONTEXT
4. UI CONTEXT
5. CODE STANDARDS
6. DEVELOPMENT WORKFLOW + PM CONVENTIONS
7. TARGET STATE inline, delete `docs/target-state.md`
8. Tracker compression, `git mv` the log to `docs/progress-tracker.md`
9. `specs/` move + four skills + all citation rewrites

Per-commit rule: **a commit repairs every citation its own deletion invalidates**, so no pointer is
ever dangling and no section has two authorities for longer than that commit. Concretely, commit 1
rewrites `tests/tenant-isolation/integration/credentials-visibility.test.ts:23` (cites `RULES.md §16`)
and `context/feature-specs/09-connections.md:28` (cites `RULES.md` section 15); commit 3 rewrites
`lib/db/repository.ts:325` (cites `context/architecture-context.md` invariants 4–5); commit 8 rewrites
`tests/admin/integration/provisioning.test.ts:9`, `tests/fixtures/README.md:5` and
`.claude/skills/feature-component/SKILL.md:18` (all cite `context/progress-tracker.md`); commit 9 takes
the `feature-specs` path citations in `README.md`, `AGENTS.md`, `docs/conventions/feature-components.md`
and the same skill file.

The read order is the one line that changes nine times. `AGENTS.md § STANDING RULES 14` names, at each
commit, only the locations that are authoritative *at that commit* — `context/project-overview.md`
while commit 2 has not run, `§ PROJECT OVERVIEW` after it has. One line edited per commit, and the
single-authority property holds throughout.

Per-commit gate: `pnpm typecheck && pnpm lint` on any commit that touches a `.ts` file (commits 1, 3,
8, 9), plus a citation grep over the live surfaces — `README.md app lib components tests
docs/conventions .claude/skills` — for the paths deleted so far, returning nothing.

Final gate: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, then the cold hermetic build
probe `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build` — the one template mechanism
that tests something prose cannot claim. The PDF fonts are vendored under `lib/exports/fonts/`, so
this is expected to pass and its value is proving that.

Rollback: `git revert` per commit. No force-push, no shared-branch reset, no `db:*` command runs in
this work.

## Out of scope

Any code change beyond comment citations · the `databaseOperation()` catch-all defect that makes
`/connections` and `/admin` need `force-dynamic` · any TARGET STATE content edit beyond relocation ·
the numbering gap in `docs/target-state.md` (planned agents are 1, 2, 3, 5 — there is no 4) ·
hosted-project parity of any kind.
