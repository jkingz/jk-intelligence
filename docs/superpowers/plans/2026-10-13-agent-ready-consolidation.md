# Agent-Ready Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold `RULES.md`, the six guidance files in `context/`, and `docs/target-state.md` into a single hand-maintained `AGENTS.md`, move the feature specs to `specs/`, and add the four template process skills — with every citation repaired in the commit that invalidates it.

**Architecture:** Ten commits, one documentation section each — the spec's nine, plus one for `# VERIFICATION STANDARDS` and `# EDITING THIS FILE`, which its budget lists but its staging never assigned. A commit is atomic in both directions: it pastes a source file's content into `AGENTS.md` under the template's heading **and** deletes the source **and** rewrites every citation that source owns, so no rule has two authoritative locations for longer than one commit. `AGENTS.md` grows to ≈1,430 lines; `next dev` manages only its marker block (`generate-agent-files.js` → `upsertAgentRulesBlock()`, Next 16.3.5), so nothing collides.

**Tech Stack:** Markdown, pnpm, Next.js 16.3.5 / TypeScript, Vitest, ESLint, GitHub Actions, git `mv` for history-preserving moves, filesystem symlinks for the skill mirror.

**Spec:** `docs/superpowers/specs/2026-10-13-agent-ready-consolidation-design.md` — read it with this plan; the section budgets, the citation enumeration and the four forced doc fixes live there.

## Global Constraints

Every task's requirements implicitly include this section.

- **Wording is preserved verbatim.** Only headings and cross-references are renamed. The one exception is Task 8 (tracker compression), which is allowed to condense prose and must list every dropped line in its commit message.
- **A line is dropped only when the destination already carries the same claim**, and each dropped line is named in that commit's message.
- **A citation names the location that is authoritative at that commit.** So `docs/target-state.md` stays cited until Task 7, and `context/progress-tracker.md` until Task 8 — even though the same sentence's body has already moved. Amend, never leave dangling.
- **Dated log entries are exempt from that amendment.** `context/progress-tracker.md`'s entries and
  `docs/superpowers/{plans,specs}/` record what was true when they were written; `RULES.md` is
  referenced in seven of the former (239, 249, 255, 546, 736, 883, 979) and stays referenced there.
  Repairing a live pointer is required; rewriting a record is falsification. A grep that "finds" one
  of these is a mis-scoped grep, not a defect — every verify step in this plan is scoped to live
  paths for that reason. The scope that works is `git grep -n "<term>" -- ':!docs/superpowers'
  ':!context/progress-tracker.md' ':!supabase/migrations'`: it walks the whole tracked tree, so it
  cannot miss a path a hand-written directory list omits, and its three exclusions are exactly the
  records. `supabase/migrations/` is excluded because rule 16 forbids rewriting an applied migration
  — `20261010000000_credential_reference_unselectable.sql:10` names `RULES.md §16` and must keep
  doing so. Task 11's final grep uses this same form.
- **Rule 14 carries a `Transitional` list that every fold task shrinks by exactly one entry** (Tasks 2–9). That is how the read order stays truthful while six files are being emptied one commit at a time. A task that forgets it leaves a pointer at a deleted file, which is the defect this whole plan is built to avoid.
- **No new facts.** Anything not pointable at existing text or code goes under `# TARGET STATE — Not Yet Built`, labelled as intent.
- **No application behavior changes.** The only `.ts` edits in this plan are comment citation strings.
- Never run a bare `db:*` script; never start a hosted apply; never push. `pnpm` only; Node ≥ 24.
- Commit messages: conventional prefix, subject says **why**, body ≤ 4 lines, no boilerplate.
  **Exception, ruled during Task 1:** when a task must name the lines it dropped or amended (the
  drop-and-name constraint above), those names come first and the budget stretches to cover them — a
  body that hides a drop to stay short breaks the rule the body exists to serve. Task 1's commit ran 9
  lines for three named drops; that is the trade, not a violation.
- `AGENTS.md` lines 1–9 (the `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->` block) are never edited by hand and never deleted.
- **A `§` reference matches its heading's exact text.** Task 1's rule 14 names the fold sections in
  ALL CAPS (`PROJECT OVERVIEW`), while Tasks 2–6 create them as title-case H2s (`## Project Overview`).
  Ruled during Task 1: the headings win, and **Task 2 amends rule 14's read-order line to title case in
  the same commit** that creates the first of those headings — one authority, one spelling, and Task 11's
  heading grep can match it literally. Tasks 3–6 create their headings with the casing rule 14 then
  cites, and change nothing else in rule 14 beyond deleting their Transitional entry.

## File Structure

```
AGENTS.md                     ← the whole instruction layer; 12 top-level sections (budgets in the spec)
CLAUDE.md                     ← unchanged; its content is exactly "@AGENTS.md"
specs/                        ← Task 9: git mv from context/feature-specs/, plus 00-template.md
docs/progress-tracker.md      ← Task 8: git mv from context/progress-tracker.md (the rolling log, demoted)
docs/conventions/             ← untouched except one citation in Task 9
docs/{diagrams,pitches,screenshots,superpowers}  ← untouched; dated plans/specs keep their old paths
.claude/skills/{testing,verification-gates,development-workflow,git-workflow}/SKILL.md  ← Task 9
.agents/skills/<same four>    ← Task 9: symlinks, matching the existing ../../.claude/skills/<name> form
RULES.md                      ← deleted by Task 1
context/                      ← deleted by Tasks 2, 3, 4, 5, 6, 8, 9 (gone after Task 9)
docs/target-state.md          ← deleted by Task 7
```

**Test cycle for docs work.** There is no unit test for a prose move, so each task's failing test is the citation grep and its passing test is the same grep returning empty, plus `wc -l` against the section budget. `pnpm typecheck && pnpm lint` run only on the tasks that touch code comments — `.ts` in Tasks 1, 3, 8, 9, and one `.mjs` comment in Task 1 (`scripts/seed-connections.mjs`, which `eslint.config.mjs` does lint, since it sets no `files:` restriction) — because a comment change needs no Supabase stack and no Vitest run, and `pnpm test:all` must not be started for one. The full chain runs once, in Task 11.

**Anchor copies by heading, not by line number.** Line numbers below orient you; the copy range is the named heading through the next heading of equal or higher level.

**Measured citation baselines**, tree-wide `git grep` with the exclusion set above, taken at `17bba45` (after Task 1). Each task's failing check should start from its own number, and each number includes the hits *inside* the file being folded, which die with that fold:

| term | hits | zeroed by |
| --- | --- | --- |
| `RULES.md` | 0 live (7 dated tracker lines exempt) | Task 1 |
| `context/project-overview` | 3 | Task 2 |
| `context/architecture-context` | 7 | Task 3 |
| `context/ui-context` | 2 | Task 4 |
| `context/code-standards` | 4 | Task 5 |
| `context/development-workflow` + `context/pm-conventions` | 4 | Task 6 |
| `docs/target-state` | 13 | Task 7 |
| `context/progress-tracker` | 13 → 11 after Tasks 2 and 4 fold their two pointers | Task 8 |
| `context/feature-specs` | 11 | Task 9 |

---

### Task 0: Branch

**Files:** none modified.

**Produces:** branch `docs/agent-ready-consolidation`, the base for Tasks 1–11.

- [ ] **Step 1: Confirm the tree is clean and record the current HEAD**

```bash
git status --porcelain
git log --oneline -1
pnpm test 2>&1 | tail -5        # the baseline count Task 11 compares against
```

Expected: the only permitted line is `?? docs/superpowers/plans/2026-10-13-agent-ready-consolidation.md`
— this plan, if its owner has not authorized committing it. Commit it or leave it untracked; either is
fine, but it must not be *modified* mid-run. Anything else uncommitted: stop and report it — do not
stash another session's work to start a docs branch.

- [ ] **Step 2: Cut the branch from the commit that carries the spec**

`origin/main` does **not** contain `docs/superpowers/specs/2026-10-13-agent-ready-consolidation-design.md`
and its `AGENTS.md` is 245 lines, not 262 — the nine commits between `origin/main` and the spec commit
are the `credential_reference` column-grant work plus this design, and this plan measures that surface
(line 116, 159, 181, 262 of `AGENTS.md`; `credentials-visibility.test.ts:23`; the tenant-isolation
section's migration list). Branching from `origin/main` would start Tasks 1–11 against a tree the plan
never described, without the spec it tells the executor to read.

```bash
git checkout -b docs/agent-ready-consolidation
```

Expected: created from the current HEAD (`e6a373f docs: the instruction layer gets one home…`), the tip
of `fix/credential-reference-column`. Say the base out loud in the first PR body: this branch is stacked
on the credential-reference work and must not be rebased onto `main` until that work lands. If it does
land first, re-run Step 3's measurements before Task 1 — the line numbers are orientation, not contract.

- [ ] **Step 3: Verify the instruction layer is in the state the spec describes**

```bash
wc -l AGENTS.md RULES.md docs/target-state.md context/*.md
grep -n "^# " AGENTS.md
```

Expected: `RULES.md` 94 · `docs/target-state.md` 356 · `context/progress-tracker.md` 1000, and `# SERVICE ARCHITECTURE — implemented surface` at line 30. If these differ, re-read the spec's budget table and adjust before porting — the line numbers in this plan are orientation, not contract.

---

### Task 1: STANDING RULES — fold `RULES.md` in, delete it

**Files:**
- Modify: `AGENTS.md` (replace the hand-maintained `## Standing Rules (read first)` stub at lines 10–11 with the full section)
- Delete: `RULES.md`
- Modify: `tests/tenant-isolation/integration/credentials-visibility.test.ts:23` (comment cites `RULES.md §16`)
- Modify: `scripts/seed-connections.mjs:6` (comment cites `RULES.md section 16`)
- Modify: `docs/conventions/feature-components.md:27` (cites `RULES.md` §13)
- Modify: `.env.example:1` (the header comment cites `RULES.md §6`) — found by `git grep`, not by the directory list this task first used, which is why the grep below is a `git grep` now
- Modify: `context/development-workflow.md:68` and `context/pm-conventions.md:21` (both start their read-order/scoping line by pointing at `RULES.md`)
- Modify: `specs/09-connections.md` — path is `context/feature-specs/09-connections.md:28` until Task 9 (comment cites `` `RULES.md` section 15 ``)

**Not touched by this task, deliberately:** the seven `RULES.md` hits in `context/progress-tracker.md`
(239, 249, 255, 546, 736, 883, 979) sit inside dated log entries describing what a past change did, and
one of them records the very act of splitting `RULES.md` into a portable core. Rewriting them would
falsify the record. They are exempted by name in the verify grep, not silently.

**Produces:** `AGENTS.md § STANDING RULES — Read first, before any task`, containing rules 1–17. Rule 14 (read order) and rule 12 (Next.js drift) are amended by later tasks.

- [ ] **Step 1: Run the failing check**

```bash
git grep -n "RULES\.md" -- ':!docs/superpowers' ':!context/progress-tracker.md' ':!supabase/migrations'
```

Expected at `01ec09c`, measured with the command above: `AGENTS.md:11`, `.env.example:1`,
`context/development-workflow.md:68`, `context/pm-conventions.md:21`,
`context/feature-specs/09-connections.md:28`, `tests/tenant-isolation/integration/credentials-visibility.test.ts:23`,
`docs/conventions/feature-components.md:27`, `scripts/seed-connections.mjs:6`. `README.md` does **not**
cite `RULES.md` — verified, not assumed. Because this grep now walks the whole tracked tree, a hit this
list does not name is genuinely new information: repair it in this commit if it is a live pointer (the
gate is "no commit leaves a pointer at a file it deletes"), and only carry forward what is a dated
record. Task 1 found exactly one such pointer — `.env.example` — and it belongs here, not in Task 9.

- [ ] **Step 2: Insert the section into `AGENTS.md`, replacing the two-line stub**

Delete the block that begins `## Standing Rules (read first)` and runs to the blank line before `## Application Building Context`. In its place, after the `<!-- END:nextjs-agent-rules -->` marker, put `# STANDING RULES — Read first, before any task` followed by `RULES.md`'s body verbatim: the `## Portable core` heading renamed `## Portable core — Rules 1–10`, rules 1–10 byte-identical, the `## This repo` heading renamed `## Project-specific rules — Rules 11–17`, rules 11–17 byte-identical.

Add one line under the section heading, adopted from the template: `Constraints that apply to every change. Read these in full before every taskable request. Skip nothing.`

- [ ] **Step 3: Amend the two rules this fold leaves untrue**

In rule 12, replace the bullet `The ## Standing Rules / context block at the top of AGENTS.md is written by next dev; committing it keeps the tree clean.` with:

```markdown
- Only the `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->` block is written
  and re-added by `next dev` — `upsertAgentRulesBlock()` in
  `node_modules/next/dist/server/lib/generate-agent-files.js` (Next 16.3.5) replaces the text between
  the markers and nothing else. Everything below it is hand-maintained; commit the block with your
  work rather than deleting it.
```

In rule 14, the read order becomes — with a `Transitional` list that Tasks 2–9 each shorten by one entry as their section lands:

```markdown
### 14. Read order
`AGENTS.md` § STANDING RULES → then, for architectural decisions, § APPLICATION BUILDING CONTEXT in
order: PROJECT OVERVIEW → ARCHITECTURE CONTEXT → UI CONTEXT → CODE STANDARDS → DEVELOPMENT WORKFLOW
→ PM CONVENTIONS. Then § SERVICE ARCHITECTURE for what exists, § TARGET STATE for what does not.

**Transitional — still authoritative as separate files:** `context/project-overview.md`,
`context/architecture-context.md`, `context/ui-context.md`, `context/code-standards.md`,
`context/development-workflow.md`, `context/pm-conventions.md`, `docs/target-state.md`,
`context/progress-tracker.md`. Delete an entry in the commit that folds its file in; the entry is a
pointer, not a note.
```

- [ ] **Step 4: Delete the source and repair every live citation it owned**

```bash
git rm RULES.md
```

Each edit changes the citation string only; the surrounding sentence stays byte-identical.

| File | From | To |
| --- | --- | --- |
| `tests/tenant-isolation/integration/credentials-visibility.test.ts:23` | `RULES.md §16` | `AGENTS.md § STANDING RULES 16` |
| `scripts/seed-connections.mjs:6` | `(RULES.md section 16)` | `(AGENTS.md § STANDING RULES 16)` |
| `docs/conventions/feature-components.md:27` | `` `RULES.md` §13 `` | `` `AGENTS.md` § STANDING RULES 13 `` |
| `context/feature-specs/09-connections.md:28` | `` `RULES.md` section 15 `` | `` `AGENTS.md` § STANDING RULES 15 `` |
| `context/development-workflow.md:68` | `` `RULES.md` → `AGENTS.md` → `context/project-overview.md` → … `` | `` `AGENTS.md` § STANDING RULES → § APPLICATION BUILDING CONTEXT `` — the trailing `context/` names are cut here because rule 14 now owns that sequence |
| `context/pm-conventions.md:21` | `` scoping rules in `RULES.md` `` | `` scoping rules in `AGENTS.md` § STANDING RULES `` |
| `.env.example:1` | `(RULES.md §6)` | `(AGENTS.md § STANDING RULES 6)` — the wrap may reflow one comment line; nothing else in the file changes |

- [ ] **Step 5: Verify**

```bash
pnpm typecheck && pnpm lint
git grep -n "RULES\.md" -- ':!docs/superpowers' ':!context/progress-tracker.md' ':!supabase/migrations'
echo "exit: $?"
wc -l AGENTS.md
```

Expected: typecheck and lint clean; the grep prints nothing and exits 1 — every live citation is
repaired, and only the exempted records still name `RULES.md`. `AGENTS.md` **366** lines: 262 − the
2-line stub + 106 pasted, where 106 (not the budget's ~95) is what Step 3's own amendments cost —
rule 12 grows 1 → 5 and rule 14 grows 2 → 10. `# SERVICE ARCHITECTURE` moves from line 30 to 134.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: standing rules move into AGENTS.md, and next dev's reach gets measured

RULES.md's 17 rules land byte-identical; the template's thinner §1-10 was not ported because
it drops the never-delete-an-understood-doc clause, the pull-origin-main-before-dev rule and
two more. Corrects rule 12: next dev regenerates only the marker block of AGENTS.md, not its
whole top; the same claim in the hand-maintained tail is repaired by Task 10."
```

---

### Task 2: PROJECT OVERVIEW — fold `project-overview.md` in

**Files:**
- Modify: `AGENTS.md` (replace the `## Application Building Context` stub, lines 13–28, with `# APPLICATION BUILDING CONTEXT` + `## Project Overview`)
- Delete: `context/project-overview.md`

**Produces:** `## Project Overview` with Status / Overview / Goals / Core user flow / Scope / Success criteria. Creates the `# TARGET STATE — Not Yet Built` heading at the file's end, which Tasks 3, 7 and 8 populate.

- [ ] **Step 1: Failing check**

```bash
grep -c "^## Project Overview" AGENTS.md
```
Expected: `0`.

- [ ] **Step 2: Port, minus the Features block**

In rule 14, retitle the six section names to the casing this task's headings use:
`PROJECT OVERVIEW → ARCHITECTURE CONTEXT → UI CONTEXT → CODE STANDARDS → DEVELOPMENT WORKFLOW → PM
CONVENTIONS` becomes `Project Overview → Architecture Context → UI Context → Code Standards →
Development Workflow → PM Conventions`. Nothing else in rule 14 changes. Name the amendment in the
commit message.

Delete the `## Application Building Context` stub (everything from that heading through the line `If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing.`). Three of its claims must survive elsewhere before you delete it — verify each, and stop if one does not hold:

```bash
grep -n "next/image" context/code-standards.md          # the Image convention lives there
grep -n "progress-tracker" context/development-workflow.md  # the update-the-tracker duty lives there
grep -n "doc is the defect\|docs are untrue\|made untrue" RULES.md  # the update-docs rule is §10/§5
```

In their place add `# APPLICATION BUILDING CONTEXT` and `## Project Overview`, containing `context/project-overview.md` verbatim from `## Overview` through `## Success Criteria`, **excluding** `## Features` (lines 42–85), which moves in Step 4.

- [ ] **Step 3: Add the Status block the template requires, with the two stale claims fixed**

Above `### Overview`, add:

```markdown
### Status

**Built** — Supabase Auth (Google + email/password) with the RLS-backed tenant gate; a multi-client
dashboard (metric cards, trends, keyword rank chart, query table, date ranges) booting from one
`GET /api/dashboard/boot`; CSV/PDF export behind a sliding-window quota; a read-only `/connections`
status page; an admin provisioning panel at `/admin` with three `/api/admin/*` write routes; and the
`app/(app)/` shell whose destination rail lists **two** rows — Dashboard and Connections
(`lib/navigation/destinations.ts`).

**Not built** — real sync (`lib/queue/worker.ts` returns `mock_completed`; dashboard rows come from
`scripts/seed.mjs` and the `api_credentials` rows `/connections` renders from
`scripts/seed-connections.mjs`), any LLM integration (no `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY`,
no Claude call in the repo), and a consumer for the `seo-sync` queue in production.

Verified: 2026-10-13, against the repo at the commit this section was ported into.
```

Both bold claims are corrections the spec records: the rail does not list Profile, and the admin panel is not "Not built".

Then mark the Core user flow honestly — append to that subsection:

```markdown
Steps that do not execute today: 6 (no AI insight exists), 7's credential-and-activation half
(`api_credentials` is read-only; the panel writes clients and members only), and 8 (the cron
enqueues; nothing consumes it). Step 3 reads seeded rows.
```

- [ ] **Step 4: Move the Features block to TARGET STATE**

At the very end of `AGENTS.md`, add:

```markdown
# TARGET STATE — Not Yet Built

Design intent that is **not** implemented. Treat this section as requirements for future work,
**never** as a description of current behavior.
```

Append `context/project-overview.md`'s `## Features` (42–85) under it as `## Product features the spec promises`, then `## Out of scope` from lines 103–111 of the same file is **not** duplicated — Scope's Out of scope stays in PROJECT OVERVIEW with its why intact.

- [ ] **Step 5: Verify and delete**

```bash
git rm context/project-overview.md
grep -c "^## Project Overview" AGENTS.md          # expect 1
grep -n "^# TARGET STATE" AGENTS.md               # expect one hit, after SERVICE ARCHITECTURE
wc -l AGENTS.md
```
Expected: `AGENTS.md` ≈ 425 lines. PROJECT OVERVIEW's own span should measure 65–75 lines. Delete `context/project-overview.md` from rule 14's Transitional list.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: the project overview moves in, and the rail and admin panel get told straight

context/project-overview.md claimed a three-row rail and an unbuilt admin panel; both were
false against destinations.ts and the shipped /admin. Its Features block moves to TARGET STATE
because nothing in it is implemented except dashboard widgets and export."
```

---

### Task 3: ARCHITECTURE CONTEXT — fold `architecture-context.md` in

**Files:**
- Modify: `AGENTS.md` (new `## Architecture Context` under APPLICATION BUILDING CONTEXT; relocate two paragraphs into `# SERVICE ARCHITECTURE`)
- Delete: `context/architecture-context.md`
- Modify: `lib/db/repository.ts:325` (comment cites `context/architecture-context.md invariant 4-5`)

**Produces:** `## Architecture Context` = Stack / System boundaries / Storage model / Persistence schema / Auth & tenancy model / Invariants 1–13.

- [ ] **Step 1: Failing check**

```bash
grep -c "^## Architecture Context" AGENTS.md    # expect 0
```

- [ ] **Step 2: Port the six subsections verbatim**

From `context/architecture-context.md`: `## Stack` → `### Stack`, `## System Boundaries` → `### System boundaries`, `## Storage Model` (incl. `### Persistence Schema`) → `### Storage model`, `## Auth & Multi-Tenancy Model` → `### Auth & tenancy model`, `## Invariants` (132–155, including the closing `/connections` note) → `### Invariants`.

One correction: the migration list at 44–48 omits `20261010000000_credential_reference_unselectable.sql`. Do not add it here — `# SERVICE ARCHITECTURE`'s Tenant-isolation section already carries the full list, and the spec's rule is one migration list. Delete the list from System boundaries and leave the sentence `Policies: see § SERVICE ARCHITECTURE → Tenant isolation.` in its place.

- [ ] **Step 3: Relocate the HTTP prose, then drop the duplicated headings**

`## HTTP API — implemented` (86–111) is prose `SERVICE ARCHITECTURE` does not carry. Move it, byte-identical, into `# SERVICE ARCHITECTURE`:
- the two precedence paragraphs (88 and the `lib/admin/*` one at 90–96) → under `## HTTP surface (what actually exists)`, before the table;
- the cache-bound invariant paragraph (102, the `vary_key_denied:cookie` story) → under `## Pages and caching`;
- `## HTTP API — planned, not built` (109–111) → dropped: `## HTTP surface` already ends with a `Planned and absent:` line. Name it as dropped-duplicated in the commit.

`## Sync Agent Model — target state, not built` (113–131) → appended to `# TARGET STATE` as `## Sync agent contract (from the architecture doc)`. It is not deduped against `docs/target-state.md` here because that file is still the authority until Task 7; Task 7 merges the two and names the overlap.

- [ ] **Step 4: Delete the source and repair its citation**

```bash
git rm context/architecture-context.md
```

In `lib/db/repository.ts:325`, replace `(context/architecture-context.md invariant 4-5)` with `(AGENTS.md § Architecture Context, invariants 4-5)`. Do not touch any other line of that file.

- [ ] **Step 5: Verify**

```bash
pnpm typecheck && pnpm lint
git grep -n "context/architecture-context" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md'; echo "exit: $?"
grep -c "20261010000000_credential_reference_unselectable" AGENTS.md   # expect ≥ 1 (one list)
wc -l AGENTS.md                                                        # expect ≈ 520
```

Delete `context/architecture-context.md` from rule 14's Transitional list.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: architecture context moves in, and the route prose lands beside the routes

Dropped as duplicated: the migration list (SERVICE ARCHITECTURE owns the full five) and the
planned-routes sentence (HTTP surface already says Planned and absent). Invariants 1-13 came
over intact, including the force-dynamic note that is load-bearing for pnpm build."
```

---

### Task 4: UI CONTEXT — fold `ui-context.md` in

**Files:**
- Modify: `AGENTS.md` (new `## UI Context`)
- Delete: `context/ui-context.md`

**Produces:** `## UI Context` with every subsection of the source in its original order and wording.

- [ ] **Step 1: Failing check**

```bash
grep -c "^## UI Context" AGENTS.md    # expect 0
```

- [ ] **Step 2: Port, nothing dropped**

Copy everything from `context/ui-context.md`'s `## Theme` through `## Icons` under `## UI Context`, demoting each heading one level. The token tables are verified hex-for-hex against `globals.css` and the design says do not compress them. Line 162's citation of `context/progress-tracker.md` stays byte-identical — that file still exists until Task 8, and Task 8 amends the pointer.

- [ ] **Step 3: Verify and delete**

```bash
git rm context/ui-context.md
grep -n "bg-base\|text-copy-primary" AGENTS.md; echo "exit: $?"   # expect exit 1: the bad tokens must not appear
wc -l AGENTS.md                                                   # expect ≈ 750
```

Delete `context/ui-context.md` from rule 14's Transitional list.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: the UI context moves in whole, token tables and all

Nothing dropped: every hex value here was checked against globals.css, and the template's own
anti-pattern list says an unverified token name fails silently rather than loudly."
```

---

### Task 5: CODE STANDARDS — fold `code-standards.md` in

**Files:**
- Modify: `AGENTS.md` (new `## Code Standards`)
- Delete: `context/code-standards.md`

**Produces:** `## Code Standards` = General / TypeScript / Next.js / React 19.3 Rendering / Security Headers / Images / Styling / API Routes / Data & Storage / Standards for new agents / Error Handling / File Organization / Testing. The Testing section is shortened in Task 9, not here, because `/testing` does not exist yet.

- [ ] **Step 1: Failing check**

```bash
grep -c "^## Code Standards" AGENTS.md    # expect 0
```

- [ ] **Step 2: Port verbatim**

Copy `## General` through the end of `## Testing`, demoting headings one level. Line 176's `docs/target-state.md` reference keeps its path until Task 7.

- [ ] **Step 3: Verify and delete**

```bash
git rm context/code-standards.md
grep -n "invented helpers\|readDashboard" AGENTS.md; echo "exit: $?"   # expect exit 1 — no invented helper names
wc -l AGENTS.md                                                        # expect ≈ 1,000
```

Delete `context/code-standards.md` from rule 14's Transitional list.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: code standards move in, Testing left whole for one more task

The Testing section stays full prose until the /testing skill exists; shortening it to a
pointer first would have pointed at a file that is not there."
```

---

### Task 6: DEVELOPMENT WORKFLOW + PM CONVENTIONS

**Files:**
- Modify: `AGENTS.md` (new `## Development Workflow — Portable core`, `## Development Workflow — Project appendix`, `## PM Conventions`)
- Delete: `context/development-workflow.md`, `context/pm-conventions.md`

**Produces:** the three sections above.

- [ ] **Step 1: Failing check**

```bash
grep -c "^## Development Workflow\|^## PM Conventions" AGENTS.md    # expect 0
```

- [ ] **Step 2: Two subsections must be preserved, not dropped**

The source's portable core (1–63) mostly restates rules 1–10, but two lines exist nowhere else. Add them to `## Development Workflow — Portable core` verbatim:
- `A guessed constant, threshold, or policy is a requirement you invented. Label it or drop it.` (line 31)
- `If a foundation file seems to need editing, the real problem is upstream of it — say so instead of working around it.` (lines 53–54)

- [ ] **Step 3: Port the three sections**

`## Development Workflow — Portable core`: the six-step loop, the scoping/requirements/verification/docs-and-truth/protected-foundations bullets that are not already rules 1–10 (see Step 2), plus this quick reference adopted from the template:

```markdown
1. Read what governs the change (§ STANDING RULES, then the context sections)
2. State scope in one sentence
3. Implement the smallest verifiable increment
4. Verify with commands, not claims
5. Update the docs the change made untrue
6. Report what changed, what was verified, what is unknown
```

`## Development Workflow — Project appendix`: the source's 65–123 verbatim (Read order, Commands table, Where logic goes, Next.js 16 fork, Schema changes, Data today, Agent development rules, Before moving to the next unit). In its `### Read order` subsection, list only what is authoritative now — `AGENTS.md` § STANDING RULES → § APPLICATION BUILDING CONTEXT (PROJECT OVERVIEW → ARCHITECTURE CONTEXT → UI CONTEXT → CODE STANDARDS) → `context/development-workflow.md`'s successors inline → `docs/target-state.md` → `context/progress-tracker.md`.

`## PM Conventions`: `context/pm-conventions.md` 6–24 verbatim (Commits, PRs), **excluding** its `## Review gate` (26–31) which restates rule 13, and **keeping** its closing `**Skip when not needed:**` lines (33–34) — that exception is not in rules 1–17.

- [ ] **Step 4: Delete both sources**

```bash
git rm context/development-workflow.md context/pm-conventions.md
```

- [ ] **Step 5: Verify**

```bash
git grep -n "context/development-workflow\|context/pm-conventions" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md'; echo "exit: $?"
grep -c "^## Development Workflow\|^## PM Conventions" AGENTS.md    # expect 3
wc -l AGENTS.md                                                     # expect ≈ 1,100
```

Delete `context/development-workflow.md` and `context/pm-conventions.md` from rule 14's Transitional list.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: the workflow and commit conventions move in, minus one review gate

Dropped as duplicated: pm-conventions' Review gate section (STANDING RULES 13 is the chain).
Kept on purpose: the guessed-constant clause, the upstream-of-the-foundation clause, and the
skip-the-PR-for-docs-only exception, none of which rules 1-10 carry."
```

---

### Task 7: TARGET STATE inline, delete `docs/target-state.md`

**Files:**
- Modify: `AGENTS.md` (`# TARGET STATE — Not Yet Built` grows; `### Invariants`/§ SERVICE ARCHITECTURE prose that cites the deleted file gets amended)
- Delete: `docs/target-state.md`

**Produces:** one TARGET STATE holding, in order: the product-features promise from Task 2, everything from `docs/target-state.md`, the sync-agent contract merged with its source, and the four planned route contracts.

- [ ] **Step 1: Failing check**

```bash
git grep -n "docs/target-state" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md' | wc -l    # expect > 0
```

- [ ] **Step 2: Port the file's seven sections verbatim**

`## Planned agents` (27–199), `## Agent Interaction Map` (200–232), `## Deployment Strategy` (233–247), `## Error Handling Per Agent` (248–275), `## Planned API Route Definitions` (276–331), `## Build sequence (original POC plan)` (332–356), under `# TARGET STATE`. Preserve the file's opening verification note (1–26) as the section's lead paragraph.

- [ ] **Step 3: Merge the two sync-agent descriptions into one**

Task 3's `## Sync agent contract (from the architecture doc)` and `## Planned agents` 1/2/3/5 describe the same unbuilt system. Keep `## Planned agents` (it is the fuller contract) and delete from the merged text only what duplicates it. The architecture doc's version carries one thing `Planned agents` lacks — the explicit sentence `No syncAgent, transformAgent, cacheAgent, or insightsAgent exists; lib/queue/worker.ts returns mock_completed.` Keep it as TARGET STATE's opening status line. List the other dropped lines in the commit message.

Do **not** renumber the agents (they are 1, 2, 3, 5 with no 4) — the spec puts that out of scope.

- [ ] **Step 4: Amend every citation to the deleted file**

```bash
git rm docs/target-state.md
```

In `AGENTS.md`, replace each `docs/target-state.md` with `§ TARGET STATE` — 3 hits when the file was written, more now that Tasks 2–6 carried citations in. Then `README.md` (line 6 and any other hit), and `context/code-standards.md` is already gone, so check the survivors:

```bash
git grep -n "docs/target-state" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md'; echo "exit: $?"
```

Expected: `exit: 1`. Delete `docs/target-state.md` from rule 14's Transitional list. `docs/superpowers/` keeps its old references untouched — a dated plan or spec that cited `docs/target-state.md` described the tree at that moment, and rewriting it would falsify the record.

- [ ] **Step 5: Verify the SERVICE ARCHITECTURE / TARGET STATE boundary**

```bash
grep -n "Planned and absent" AGENTS.md    # expect 1 hit, and it must name the routes only
grep -c "^# TARGET STATE" AGENTS.md       # expect 1
```

The template's rule is that a planned route is listed once. If SERVICE ARCHITECTURE's `Planned and absent` line still enumerates routes, replace the list with `Planned and absent: see § TARGET STATE → Planned API Route Definitions.`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: target state lives where the implemented surface is described

Two sync-agent descriptions merged into one, and the docs/superpowers records keep citing a
path that no longer exists on purpose — they describe the tree as it was, and rewriting a
finished plan's references would falsify it. Agents keep their 1,2,3,5 numbering."
```

---

### Task 8: Tracker compression, log demotion

**Files:**
- Move: `git mv context/progress-tracker.md docs/progress-tracker.md`
- Modify: `AGENTS.md` (`### Open product questions` under PROJECT OVERVIEW; Status amended)
- Modify: `tests/admin/integration/provisioning.test.ts:9`, `tests/fixtures/README.md:5`, `.claude/skills/feature-component/SKILL.md:18`, `docs/conventions/feature-components.md:8` and `:39`, `README.md:5`, `context/feature-specs/07-admin.md:122`, and four carried-in `AGENTS.md` pointers enumerated in Step 4 — the set measured by `git grep -n "context/progress-tracker"` at that commit, minus dated log entries

**Produces:** `### Open product questions` in PROJECT OVERVIEW; the rolling log at `docs/progress-tracker.md`, out of the read order.

- [ ] **Step 1: Failing check**

```bash
git grep -n "context/progress-tracker" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md' | wc -l    # expect ≥ 11 (measured 13 at plan time; two die with earlier folds)
```

- [ ] **Step 2: Compress the four live sections into `AGENTS.md`**

This is the plan's one condensing task. From `## Current Phase` (5–19), `## Current Goal` (20–47), `## In Progress` (191–214) and `## Open Questions` (885–994), write `### Open product questions` under PROJECT OVERVIEW as the questions only — each one line, each naming what the owner has not decided. Do not carry forward anything that is actually a status claim; Status already says it. Record in the commit message every decision-line you drop, with the reason.

Then amend `### Status`'s last line to point at the demoted log:

```markdown
State of record for completed work: `docs/progress-tracker.md`.
```

- [ ] **Step 3: Move the log with history**

```bash
git mv context/progress-tracker.md docs/progress-tracker.md
```

Its own body keeps its historical text, including lines that cite `RULES.md §13` and `docs/target-state.md` — those are dated entries, not live pointers. Add one note at the top, immediately under `# Progress Tracker`:

```markdown
> Demoted from `context/` on 2026-10-13 and out of the read order. This is a rolling log: entries
> below cite the paths that were authoritative when they were written, and those citations are kept
> as written. Current guidance lives only in `AGENTS.md`.
```

- [ ] **Step 4: Repair the live pointers**

Rewrite, in each file's own wording, the path only:
- `tests/admin/integration/provisioning.test.ts:9` → `docs/progress-tracker.md`
- `tests/fixtures/README.md:5` → `docs/progress-tracker.md`
- `.claude/skills/feature-component/SKILL.md:18` → `docs/progress-tracker.md` (the tracker "In Progress" entry step)
- `docs/conventions/feature-components.md:8` → `docs/progress-tracker.md` (the PR-body note)
- `docs/conventions/feature-components.md:39` → `docs/progress-tracker.md` (the "feature owns its context files update" line — at this commit `context/` holds only `feature-specs/`, which Task 9 moves, so reword the line to name the spec and the log, not "context files")
- `.claude/skills/feature-component/SKILL.md` — check the whole file, not just line 18; it is the one skill this plan does not author, and if it names other `context/` paths they move with Task 9's grep
- `README.md:5`'s two links → `AGENTS.md` for scope (its `context/project-overview.md` pointer dies with Task 2's fold, so by now it must already point at `AGENTS.md § PROJECT OVERVIEW`) and `docs/progress-tracker.md` for status
- `AGENTS.md` — four carried-in pointers, each created by an earlier fold: `### Status`'s "State of record" line (from `context/project-overview.md:15`, Task 2), `## UI Context`'s "(see …)" clause (from `context/ui-context.md:162`, Task 4), § SERVICE ARCHITECTURE line 159 ("see `context/progress-tracker.md`" in the queue/worker section, hand-maintained since before this plan), and § DEVELOPMENT WORKFLOW's "Before moving to the next unit" item 3 (from `context/development-workflow.md:121`, Task 6). All four → `docs/progress-tracker.md`.
- `context/feature-specs/07-admin.md:122` → `docs/progress-tracker.md`. The file's *path* changes in Task 9; its tracker pointer is this task's, because this task is what makes the pointer wrong.
- § STANDING RULES 14: drop the tracker from the read order, delete `context/progress-tracker.md` from the Transitional list, and name `context/feature-specs/` as the per-unit spec location — `specs/` is still Task 9's to create, so naming it here would dangle.

- [ ] **Step 5: Verify**

```bash
pnpm typecheck && pnpm lint
git grep -n "context/progress-tracker" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md'; echo "exit: $?"
git log --oneline -1 --follow -- docs/progress-tracker.md    # expect: the move commit, history intact
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: the tracker stops being required reading, and the log keeps its own stale pointers

A 1,000-line rolling log in the read order is how a session starts by reading 700 lines of
finished work. The log's own historical citations are left as written; only live pointers moved."
```

---

### Task 9: `specs/`, the four skills, the skill mirror, remaining citations

**Files:**
- Move: `git mv context/feature-specs specs`
- Create: `specs/00-template.md`
- Create: `.claude/skills/testing/SKILL.md`, `.claude/skills/verification-gates/SKILL.md`, `.claude/skills/development-workflow/SKILL.md`, `.claude/skills/git-workflow/SKILL.md`
- Create: `.agents/skills/{testing,verification-gates,development-workflow,git-workflow}` (symlinks)
- Modify: `AGENTS.md` (`# FEATURE SPECS`, `## Repo skills`, `## Verification`'s test-folder table, § Code Standards → Testing shortened)
- Modify: `README.md`, `docs/conventions/feature-components.md`, `.claude/skills/feature-component/SKILL.md` path citations

**Produces:** the final tree. After this task `context/` is gone.

- [ ] **Step 1: Move the specs with history**

```bash
git mv context/feature-specs specs
git grep -n "context/feature-specs" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md' | wc -l    # the count you must now zero
```

- [ ] **Step 2: Create `specs/00-template.md`**

Copy the template's `context/feature-specs/00-template.md` from the agent-ready template folder byte-identical (its `# \`<NN>\` — \`<feature name>\`` header already matches the nine files here). Then append:

```markdown
## Where the two spec homes differ

`specs/` holds numbered feature specs — one deliverable unit each, named in implementation order.
`docs/superpowers/specs/` holds dated design docs from brainstorming. File a design doc there and a
feature spec here; `AGENTS.md § FEATURE SPECS` says so in one line.
```

- [ ] **Step 3: Write the four skills**

Frontmatter matches every existing skill in this repo (`name` + one-line `description`). Every one of them names the real commands — no `<cmd>` slot survives.

`.claude/skills/verification-gates/SKILL.md`:

````markdown
---
name: verification-gates
description: The command chain that must be green before work is reported complete, and how to report each gate.
---

# Verification Gates

## The chain, in this order

1. **Tests** — `pnpm test` (the Vitest **unit** project, not the suite). Name the tier a run covered.
   - Integration tier: `pnpm test:all` — needs `pnpm exec supabase start` and a filled `.env.test`.
   - Browser tier: `pnpm test:e2e`.
   - A green integration tier can mean **nothing ran**: all three files `skipIf(!TEST_SUPABASE_URL)`,
     so read the passed/skipped counts, never the exit code.
   - Narrow with `pnpm test <path>`, never `pnpm test -- <path>` — the second form silently runs
     everything.
2. **Typecheck** — `pnpm typecheck` (runs `next typegen` first). Proves types, not behavior.
3. **Lint** — `pnpm lint`.
4. **Build** — `pnpm build`. Anything the build fetches over the network is a latent CI failure.
5. **Live exercise** — when a test cannot reach it (a page, a migration, a queue job), exercise it
   and report the observation. "It should work" is not a status.

## Reporting

For each gate: the command, its output or count, pass or fail.

```
Tests: pnpm test → <count> passed, 0 failed
Typecheck: pnpm typecheck → No errors found
Lint: pnpm lint → No problems reported
Build: pnpm build → <n> pages, 0 errors
Live: /connections served a seeded tenant's three sources, status columns only
```

Fill `<count>` and `<n>` from the run in front of you. They are report-format holes, not literals —
typing a number from memory or from an older doc is the defect this skill exists to prevent.

`.github/workflows/ci.yml` runs 1–4 plus the public e2e tier on every push to `main`/`dev` and on
pull requests. The credential-gated integration tier is the gap CI does not close; say so when a
green CI is offered as evidence.

## A gate that only passes on this machine is not a gate

Prove the build is hermetic before trusting a warm cache:
`NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build`.

- The rules this skill implements are `AGENTS.md § STANDING RULES 13`. Read that, not this file, for
  the contract.
````

`.claude/skills/testing/SKILL.md`:

````markdown
---
name: testing
description: Test tiers, organization, mocking boundaries, and route coverage requirements for this repo.
---

# Testing

## Organization

`tests/<feature>/<tier>/`, tiers `unit`, `integration`, `e2e`. Never beside the module. Import the
subject through `@/`, never relatively — a `./` specifier can resolve to a neighbouring file of the
same name. `tests/helpers/` is the one exception and may be imported relatively.
Name files `<sut>.test.ts` (unit/integration) or `<flow>.spec.ts` (e2e).

`AGENTS.md § Verification` owns the table of which feature folder owns which modules.

## Mocking

Unit tier only, and only at the I/O boundary: `@/lib/agents/...`, `@/lib/db/repository`. Never inside
business logic, never a real network or DB call. The integration tier exists precisely to put a real
Postgres behind `canAccessClient` — do not mock there.

## Coverage every route handler needs

`401` unauthenticated · `403` not this caller's client · `400` malformed id · **no-data-before-auth**
(the handler checks identity before it reads). Route tests live in `<name>-route.test.ts`.
Ownership and isolation need a two-tenant fixture proving a foreign id cannot be read.

## Running

```bash
pnpm test                 # unit project
pnpm test:all             # + integration, against the local stack
pnpm test:e2e             # public browser tier
pnpm test tests/dashboard # one folder
```

## What the integration tier covers today

Three files, all `skipIf(!TEST_SUPABASE_URL)`: `rls-gate.test.ts` and
`credentials-visibility.test.ts` (live RLS on `clients` and `api_credentials`, including the column
grant that denies `credential_reference` with `42501`), plus
`tests/admin/integration/provisioning.test.ts` (the five admin definer RPCs). Quote the collected
count rather than the file list if you need a number.

- Contract lives in `AGENTS.md § STANDING RULES 13` and `§ Code Standards → Testing`.
````

`.claude/skills/development-workflow/SKILL.md`:

````markdown
---
name: development-workflow
description: The per-unit work loop — read order, scope statement, smallest increment, verification, doc repair, report.
---

# Development Workflow

## The loop, per unit of work

1. Read what governs the change: `AGENTS.md § STANDING RULES`, then the context sections for the
   module being touched.
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

Do not invent behavior that is not in `AGENTS.md`. Ambiguous → resolve it in the relevant section,
then implement. Missing → record it as an open question in `specs/` and stop that branch of work.
A guessed constant, threshold, or policy is a requirement you invented: label it or drop it.

## Docs and truth

Code is the source of truth; where a doc and the code disagree, the doc is the defect and you fix it
in the same change. Unbuilt intent lives in `AGENTS.md § TARGET STATE` and may never be cited as
current behavior. No rotting literals — quote command output instead of typing a count.

## Before moving to the next unit

The unit works end to end inside the scope stated at step 2; no invariant in
`§ Architecture Context → Invariants` was violated (4, 12 and 13 are the ones that break silently);
`§ SERVICE ARCHITECTURE` describes what now exists; the full gate chain is green; no orphaned dev
server, worker or background process.

- `AGENTS.md § STANDING RULES` and `§ Development Workflow — Project appendix` hold the contract.
````

`.claude/skills/git-workflow/SKILL.md`:

````markdown
---
name: git-workflow
description: Commit conventions, push discipline for this repo's dev branch, PR shape, and the review gate.
---

# Git Workflow

## Commits

Conventional prefixes: `feat:` `fix:` `style:` `perf:` `refactor:` `chore:` `docs:` `test:` `build:`
`ci:`. One logical change per commit. Subject says **why**; body ≤ 4 lines. No co-authors, no
"generated with", no boilerplate. Check `git status` before `git add` — `.env*` is gitignored and a
real env value must never land in a commit.

## Push discipline

Commit, push, open or merge a PR **only when asked**. Before pushing to `dev`: `git pull` from
`origin main`, merge, resolve conflicts, then commit and push — never push to `dev` without that
pull. No `--no-verify`, no skipped hooks, no bypassed signing; a failing hook is a finding to fix at
the cause. Never force-push a shared branch, and never `git reset --hard` / `clean -f` /
`checkout --` over work you did not write. Destructive or externally visible actions need explicit
authorization every time, not once-and-forever.

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
````

- [ ] **Step 4: Mirror to `.agents/skills/` as symlinks, and name the mechanism**

```bash
cd .agents/skills
for s in testing verification-gates development-workflow git-workflow; do ln -s "../../.claude/skills/$s" "$s"; done
cd ../..
find .agents/skills -maxdepth 1 -type l | sort      # expect the 4 new ones + feature-component
ls -L .agents/skills/testing/SKILL.md              # resolves through the link
```

Then update `AGENTS.md ## Repo skills`: it currently warns that the mirror is "not one mechanism: some entries are symlinks, some genuine hardlinks, some plain copies". Add the four new entries as **symlinks** and keep the warning — it is still true of the older entries.

- [ ] **Step 5: Point `AGENTS.md` at the skills and shorten § Code Standards → Testing**

Replace § Code Standards' `### Testing` body with the template's five key points plus the pointer:

```markdown
See `/testing` for tiers, organization, mocking patterns and commands.

- Tests live in `tests/<feature>/<tier>/`, imported through `@/`, never relatively
- Mock at the boundary, unit tier only
- Every route test covers `401`/`403`/`400` and no-data-before-auth
- Opt-in tiers exit 0 — report which tier a run covered
```

Add `# FEATURE SPECS` before `# TARGET STATE`:

```markdown
# FEATURE SPECS

Feature specifications live in `specs/`, one file per deliverable unit, numbered in implementation
order; `specs/00-template.md` is the skeleton. `docs/superpowers/specs/` holds dated design docs
instead — a spec states requirements for one unit, a design doc records one decision.
```

Add the four skills to `## Repo skills`' load-when list.

- [ ] **Step 6: Repair the last `context/` pointers**

`README.md` (its ordered-`context/`-files sentence, the doc links), `docs/conventions/feature-components.md`, `.claude/skills/feature-component/SKILL.md`, `specs/07-admin.md`, `specs/09-connections.md`, `specs/00-template.md` if it names a `context/` path, and `## Verification`'s test-folder table if it still says `context/feature-specs`.

- [ ] **Step 7: Verify**

```bash
pnpm typecheck && pnpm lint
ls context 2>&1 | head -2                                   # expect: No such file or directory
git grep -n "RULES\.md\|context/" -- ':!docs/superpowers' ':!supabase/migrations' ':!context/progress-tracker.md' ':!docs/progress-tracker.md'; echo "exit: $?"
git log --oneline -1 --follow -- specs/09-connections.md     # expect the move visible in history
```

Expected: `context/` gone; the citation grep prints `exit: 1`. Rule 14's **Transitional** paragraph is now empty of live entries — delete the whole paragraph, and amend its read-order line to name `specs/`. The three memory notes and dated plans under `docs/superpowers/` are allowed to name old paths and are excluded from that grep on purpose.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "docs: one file to read, four skills to run, and the specs folder says its name

The four skills are filled with this repo's commands, not the template's slots, and the mirror is
symlinks with the mechanism written down — a copy would drift while still looking paired."
```

---

### Task 10: VERIFICATION STANDARDS and `# EDITING THIS FILE`

**Files:**
- Modify: `AGENTS.md` (add `# VERIFICATION STANDARDS — Quality guardrails`; replace the existing `## Editing this file` at the file's end with `# EDITING THIS FILE`)

**Produces:** the two sections the spec's budget lists and Tasks 1–9 never assigned. Nothing is ported here — this is the only authoring task, and both sections sit between `# SERVICE ARCHITECTURE` / `# TARGET STATE` and the file's end.

- [ ] **Step 1: Prove the third false next-dev claim still stands**

```bash
grep -n "regenerated by \`next dev\`" AGENTS.md
```

Expected: one hit in `## Editing this file` — "`AGENTS.md`'s top block ("This is NOT the Next.js you know" through the context-file list) is regenerated by `next dev`". Task 1 corrected the same claim inside rule 12; this instance lives in the hand-maintained tail, which no earlier task touches.

- [ ] **Step 2: Write `# EDITING THIS FILE`, replacing the section whole**

```markdown
# EDITING THIS FILE

`next dev` writes one thing: the text between `<!-- BEGIN:nextjs-agent-rules -->` and
`<!-- END:nextjs-agent-rules -->`. `upsertAgentRulesBlock()` in
`node_modules/next/dist/server/lib/generate-agent-files.js` (Next 16.3.5) replaces that span and
nothing else, so everything below it — including `# SERVICE ARCHITECTURE` — is hand-maintained and
never arrives by generation. Commit the marker block with your work rather than deleting it.

## When each section changes
- **STANDING RULES** — when a rule about *how* work gets done changes. Not when a feature ships.
- **PROJECT OVERVIEW / ARCHITECTURE CONTEXT** — when a decision is made, before the code exists.
- **SERVICE ARCHITECTURE** — implemented code only. When something becomes true, move it out of
  `# TARGET STATE` in the same commit that made it true.
- **TARGET STATE** — whenever intent outpaces implementation. Never cite it as current behavior.
- **specs/** — one file per deliverable unit. `specs/00-template.md`.

## Completeness — the checks that work
No slot grep. The template's `grep -n '<[a-zA-Z_/]' AGENTS.md` cannot run against a filled file:
`<clientId>`, `<CRON_SECRET>` and `<type>(<scope>)` are real text here, so it reports noise forever
and trains people to ignore a gate. Instead:
1. Every § named by rule 14 exists: `grep -n "^# \|^## " AGENTS.md`.
2. Every file and route cited here exists: `git ls-files <path>`, `find app/api -name route.ts`.
3. Every command cited here exists: `pnpm run` lists them.
4. No test count, line count or version number is typed into this file. Quote command output.
```

- [ ] **Step 3: Write `# VERIFICATION STANDARDS`, three rows only**

The template ships thirteen bad-line rows; ten are already corrected inline in this file (`is_stale`, the four unbuilt agents, the JSONB metrics column, `users.email`, the invented handler helpers, status precedence, the `sync_logs` writer, the `bg-base` tokens, the `<img>` warning severity). Do not duplicate them — one authority per rule. Add only what is still unabsorbed, placed after `# TARGET STATE`:

```markdown
# VERIFICATION STANDARDS — Quality guardrails

A sentence earns its place in this file only if its author read the thing this session. These are the
failure modes no inline correction has closed yet.

| Bad line | Why it is wrong | Good line |
| --- | --- | --- |
| "60 tests passing." | A count rots the day someone adds a test — and `RULES`-era docs here carried exactly that kind of stale number. | Run the command, quote its output in the reply, type nothing into the doc. |
| "Integration tests pass." | All three integration files `skipIf(!TEST_SUPABASE_URL)`. A green tier that collected nothing is indistinguishable from coverage unless the count is read. | "integration tier: N passed, 0 skipped" — or say it skipped for want of `TEST_*` names. |
| "Build passes locally and in CI." | The build once fetched a font over the network; a warm cache hid it for weeks and the sealed runner had no route to it. | Name the probe: `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build`. Here the Noto TTFs are vendored in `lib/exports/fonts/`, so the probe passes. |
```

- [ ] **Step 4: Verify the section order and the claim**

```bash
grep -n "^# " AGENTS.md
grep -n "regenerated by \`next dev\`" AGENTS.md; echo "exit: $?"
```

Expected: heading order ends `# SERVICE ARCHITECTURE` → `# FEATURE SPECS` → `# TARGET STATE` → `# VERIFICATION STANDARDS` → `# EDITING THIS FILE`; the bad claim is gone (`exit: 1`).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: the file says how it is maintained, and guards against its own failure modes

The last false claim about next dev's reach lived in the hand-maintained tail, which no porting
task touched. Ten of the template's thirteen anti-pattern rows were already corrected inline in
this file, so only the three unclosed ones were added."
```

---

### Task 11: Final gate

No commit unless a gate fails and needs a repair.

- [ ] **Step 1: The full chain**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: unit tier passes with the same count as the run recorded at Task 0 Step 1's baseline; no type or lint errors; build reports the same route table as that baseline — `/dashboard` still `○`, `/connections` and `/admin` still `ƒ`. A route-table change here would mean a docs edit touched code, which the plan's own constraint (no behavior changes; the only `.ts` edits are comment strings) is meant to make impossible.

- [ ] **Step 2: Hermetic build probe**

```bash
NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build
```

Expected: succeeds. PDF fonts are vendored under `lib/exports/fonts/`, so this proves that and nothing else. If it fails, the build is fetching something — report what, do not add a network exception.

- [ ] **Step 3: Prove `next dev` leaves the consolidated file alone**

```bash
pnpm dev --port 3799 > /tmp/agent-consolidation-dev.log 2>&1 &
DEV_PID=$!
# wait for the ready line, then stop it — AGENTS.md § STANDING RULES 5 forbids an orphaned server
sleep 12 && kill $DEV_PID
git status --porcelain AGENTS.md CLAUDE.md; echo "exit: $?"
```

Expected: `exit: 1` with no output — neither file rewritten. Check `/tmp/agent-consolidation-dev.log` for an agent-files notice, then delete it.

- [ ] **Step 4: Prove the read order resolves inside the file**

```bash
grep -n "^# \|^## " AGENTS.md
wc -l AGENTS.md
```

Expected, in order: the marker block; `# STANDING RULES` (rules 1–17, with no Transitional paragraph left standing after Task 9); `# APPLICATION BUILDING CONTEXT` carrying PROJECT OVERVIEW / ARCHITECTURE CONTEXT / UI CONTEXT / CODE STANDARDS / DEVELOPMENT WORKFLOW portable + appendix / PM CONVENTIONS; `# SERVICE ARCHITECTURE`; `# FEATURE SPECS`; `# TARGET STATE`; `# VERIFICATION STANDARDS`; `# EDITING THIS FILE`. Total ≈1,430 lines. Rule 14 must name only sections that appear in that grep's output — that check replaces the template's slot health check, which this design rejects.

- [ ] **Step 5: Report**

State: the chain's output, the probe's result, `AGENTS.md`'s line count, the count of deleted files (8: `RULES.md`, six `context/` guidance files, `docs/target-state.md`), and the two moves (`specs/`, `docs/progress-tracker.md`). Say explicitly that no push happened and nothing was applied to the hosted project.

---

## Deferred, not forgotten

- The template's `README.md`, `START-HERE.md` and `.github/workflows/ci.yml` were not ported: this repo's CI already runs the filled-in chain, and an onboarding guide is for a template, not a product.
- The size lever (compress token tables to utilities referenced in JSX; cut TARGET STATE to the agent contracts, ≈300 lines) stays available if the 1,430-line load cost shows up in practice.
- The spec's section budget included `# VERIFICATION STANDARDS` (20 lines) and `# EDITING THIS FILE`, but its nine-commit staging assigned neither — Task 10 exists to close that gap, which is why this plan runs to ten commits.
