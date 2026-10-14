# AGENTS.md docs/ Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim `AGENTS.md` to the marker block, § STANDING RULES 1–17, a pointer map, and the two self-governance sections, moving the ~1550 lines of reference prose below rule 17 into per-topic directories under `docs/`.

**Architecture:** Three new doc homes — `docs/architecture/` (implemented surface), `docs/target-state/` (design intent), `docs/context/` (six files, one per former `## ` subsection of APPLICATION BUILDING CONTEXT). `AGENTS.md` keeps every binding rule and gains a § Reference map table; the repo's existing `FILE.md § Heading` citation form (defined in § Notation) carries the cross-file pointers, so the notation itself does not change.

**Tech Stack:** Markdown only. Extraction via `git show` + Python 3 stdlib (no new deps). Verification via `git grep` / `awk` / Python one-offs plus the repo gate chain.

**Spec:** `docs/superpowers/specs/2026-10-13-agent-ready-consolidation-design.md` is the prior state this plan partially unwinds — read its "one file" ruling before executing; this split is the owner's explicit reversal of it for everything below rule 17. Baseline branch: `docs/agent-ready-consolidation`, HEAD `ec8d750`.

## Global Constraints

- `AGENTS.md § STANDING RULES 1`–`17` and the `next dev` marker block stay in `AGENTS.md`, verbatim except where a rule cites a moved heading (rule 14's read-order block; rules 12/13/15/16's `§` pointers). The portable-core preamble ("Rules 1–10 … verbatim in any new project") must remain true — rules 1–10 unchanged.
- Dated records are FROZEN: `docs/progress-tracker.md`'s dated entries, everything under `docs/superpowers/`, and applied migrations in `supabase/migrations/` keep their old `AGENTS.md § …` citations exactly (the § Notation exception; repairing a record is falsification).
- `specs/` files, `README.md`, `docs/conventions/*` and the repo skills are LIVE — their citations get repaired in the same commit series.
- Commit, do not push. One logical change per commit, `docs:` prefix, no body boilerplate (PM Conventions).
- `docs/conventions/` holds only `feature-components.md` today — beyond the listed citation fixes there, don't create or edit any other file there. `components/ui/*` and `lib/supabase/*` are protected foundations (untouched here anyway).
- Moved prose is relocated, not rewritten: content lines copy verbatim; only `§` citation forms change, per this plan's tables.
- The four gates `pnpm test && pnpm typecheck && pnpm lint && pnpm build` run once at the end (Task 5) and must print green; quote each output in the final report.

---

### Task 0: Pre-flight and baseline capture

**Files:**
- Create: `docs/superpowers/plans/2026-10-14-agents-md-docs-split.md` (this file)
- Read-only: `AGENTS.md`

**Interfaces:**
- Produces: `BASE` = the HEAD SHA recorded here, and the verified section-boundary table used by every later task's extraction script.

- [ ] **Step 1: Verify the working tree is clean**

```bash
git status --porcelain
```

Expected: no output. This repo has content filters configured, so if the command itself refuses, stop and ask the owner — do not proceed on an unknown tree.

- [ ] **Step 2: Verify the section boundaries this plan assumes**

```bash
grep -n '^# STANDING RULES\|^## Project-specific rules\|^# APPLICATION BUILDING CONTEXT\|^## Project Overview\|^## Architecture Context\|^## UI Context\|^## Code Standards\|^## Development Workflow — Portable core\|^## PM Conventions\|^# SERVICE ARCHITECTURE\|^# FEATURE SPECS\|^# TARGET STATE\|^# VERIFICATION STANDARDS\|^# EDITING THIS FILE' AGENTS.md
```

Expected on HEAD `ec8d750` (line numbers from the measured file):

| Heading | Line |
| --- | --- |
| `# STANDING RULES` | 10 |
| `## Project-specific rules — Rules 11–17` | 71 |
| `# APPLICATION BUILDING CONTEXT` | 117 |
| `## Project Overview` | 119 |
| `## Architecture Context` | 243 |
| `## UI Context` | 351 |
| `## Code Standards` | 652 |
| `## Development Workflow — Portable core` | 913 |
| `## Development Workflow — Project appendix` | 953 |
| `## PM Conventions` | 1017 |
| `# SERVICE ARCHITECTURE` | 1045 |
| `# FEATURE SPECS` | 1328 |
| `# TARGET STATE` | 1334 |
| `# VERIFICATION STANDARDS` | 1739 |
| `# EDITING THIS FILE` | 1750 |

Any mismatch: STOP, re-derive ranges from the live file, and update every `LO`/`HI` in later tasks before touching anything.

- [ ] **Step 3: Capture the citation baseline for later dead-pointer scans**

```bash
grep -o '§' AGENTS.md | wc -l   # record as N_total
git grep -c 'AGENTS\.md` §' AGENTS.md   # expected: 1 (portable-core note)
```

Write both numbers into your report. Task 4's checks compare against them.

- [ ] **Step 4: Commit the plan file**

```bash
git add docs/superpowers/plans/2026-10-14-agents-md-docs-split.md
git commit -m "docs: plan for splitting AGENTS.md reference prose into docs/"
```

---

### Task 1: Extract the three doc homes (pure move, no edits yet)

**Files:**
- Create: `docs/architecture/README.md`, `docs/target-state/README.md`, `docs/context/README.md`, `docs/context/project-overview.md`, `docs/context/architecture-context.md`, `docs/context/ui-context.md`, `docs/context/code-standards.md`, `docs/context/development-workflow.md`, `docs/context/pm-conventions.md`
- Test: line-conservation arithmetic (Step 3)

**Interfaces:**
- Produces: byte-exact moved trees whose files' top-level headings are identical to the heading names cited everywhere (`# SERVICE ARCHITECTURE — implemented surface`, `# Project Overview`, …), so Task 3's pointer rewrites are the only citation edits ever needed.
- Consumes: `BASE` SHA + the boundary table from Task 0.

- [ ] **Step 1: Extract with the boundary line numbers (script is deterministic)**

```bash
python3 - <<'EOF'
import subprocess
src = subprocess.run(["git", "show", "BASE:AGENTS.md"],
                     capture_output=True, text=True, check=True).stdout.splitlines(keepends=True)
def w(path, lo, hi, header=None):        # lo/hi are 1-based inclusive, from the Task 0 table
    lines = src[lo-1:hi]
    with open(path, "w") as f:
        if header: f.write(header)
        f.writelines(lines)
    print(path, len(lines))
import os
for d in ("docs/architecture", "docs/target-state", "docs/context"):
    os.makedirs(d, exist_ok=True)
w("docs/architecture/README.md", 1045, 1333)                    # SERVICE ARCHITECTURE + FEATURE SPECS verbatim
w("docs/target-state/README.md", 1334, 1738)                    # TARGET STATE
w("docs/context/project-overview.md", 119, 242)                 # ## Project Overview  -> demote to #
w("docs/context/architecture-context.md", 243, 350)
w("docs/context/ui-context.md", 351, 651)
w("docs/context/code-standards.md", 652, 912)
w("docs/context/development-workflow.md", 913, 1016)
w("docs/context/pm-conventions.md", 1017, 1044)
w("docs/context/README.md", 117, 118, "Read order and the rest of the pointers live in `AGENTS.md` § Reference map.\n\n")
EOF
```

Replace `BASE` with the SHA from Task 0. Then demote the six context files' top heading by exactly one level (their `## X` becomes `# X`, `### Y` stays `## Y`? No — keep heading *names* byte-identical and only change the six top lines):

```bash
for f in docs/context/*.md; do
  [ "$f" = docs/context/README.md ] && continue
  sed -i '' "2s/^## /# /" "$f"     # line 2: blank line 1 is not guaranteed — verify first!
done
```

Safer: open each file, change the single `## <Name>` top line to `# <Name>` manually — exactly six edits, no sed surprises on macOS `''` quoting.

- [ ] **Step 2: Set `docs/context/README.md` body**

Replace its extraction content (lines 117–118 are just the `# APPLICATION BUILDING CONTEXT` heading and spacing) with:

```markdown
# Application Building Context

The six sections that were `AGENTS.md` § APPLICATION BUILDING CONTEXT, split one file per
`## ` heading. Read them in this order (it is `AGENTS.md` rule 14's order):

1. `docs/context/project-overview.md` — § Project Overview
2. `docs/context/architecture-context.md` — § Architecture Context
3. `docs/context/ui-context.md` — § UI Context
4. `docs/context/code-standards.md` — § Code Standards
5. `docs/context/development-workflow.md` — § Development Workflow (portable core + project appendix)
6. `docs/context/pm-conventions.md` — § PM Conventions

Inside these files a bare `§` names a heading in the same file; a pointer to anything else names
its file — the same notation `AGENTS.md` § Notation defines.
```

- [ ] **Step 3: Verify line conservation — no content lost or invented**

```bash
wc -l docs/architecture/README.md docs/target-state/README.md docs/context/*.md
```

Expected: `docs/architecture/README.md` = 289 (1333−1045+1); `docs/target-state/README.md` = 405 (1738−1334+1); the six context files sum to exactly 926 (1044−119+1) **before** README and heading-level edits; after the six `##`→`#` edits the sum is unchanged. Any other number = a truncated or duplicated move: fix before continuing, never by hand-writing content.

- [ ] **Step 4: Verify the moved trees contain the expected headings**

```bash
grep -c '^# SERVICE ARCHITECTURE' docs/architecture/README.md      # 1
grep -c '^# FEATURE SPECS' docs/architecture/README.md             # 1
grep '^# ' docs/context/*.md                                       # one per file, names match the table above
```

- [ ] **Step 5: Commit**

```bash
git add docs/architecture docs/target-state docs/context
git commit -m "docs: extract reference prose from AGENTS.md into docs/architecture, target-state, context"
```

---

### Task 2: Rewrite `§` citations inside the moved trees

Content is not touched — only citation forms. Every rewrite is `§ X` → `file § X` where `X` left `AGENTS.md`; bare `§ X` stays only where `X` is a heading in the *same* file (e.g. `§ UI Context` inside `docs/context/ui-context.md` is now dead — it must name the file; `§ System boundaries` inside `architecture-context.md` is valid and stays).

**Files:**
- Modify: `docs/architecture/README.md` (4 sites — exact lines, relative to the extracted file, from the measured source)
- Modify: `docs/target-state/README.md` (11 lines carrying §)
- Modify: `docs/context/ui-context.md` (1 site: `§ File Organization` → `docs/context/code-standards.md § File Organization`)
- Modify: `docs/context/code-standards.md` (4 sites)
- Modify: `docs/context/development-workflow.md` (8 sites)
- Modify: `docs/context/pm-conventions.md` (1 site: "§ STANDING RULES (standing constraints) and § Development Workflow" — first names `AGENTS.md`, second is same-file, stays bare)
- Modify: `docs/context/project-overview.md` (1 site)
- Test: the dead-pointer scan, Step 4

**Interfaces:**
- Consumes: extraction from Task 1.
- Produces: moved trees where every `§` resolves inside its own file or names its file — so Task 3's `AGENTS.md` pointer block is the only place a bare cross-file `§` can ever appear.

- [ ] **Step 1: Fix `docs/architecture/README.md`** (file-relative lines from the measured source; the § column shows the current text)

| ~Line | Was | Becomes |
| --- | --- | --- |
| 4 | `§ TARGET STATE; never cite…` | `docs/target-state/README.md § TARGET STATE; never cite…` |
| 24 | `see § TARGET STATE` | `see docs/target-state/README.md § TARGET STATE` |
| 143 | `see § TARGET STATE → Planned API Route Definitions` | `see docs/target-state/README.md § TARGET STATE → Planned API Route Definitions` |
| 152 | `see § Open product questions` | `docs/context/project-overview.md § Project Overview → Open product questions` |

Note: FEATURE SPECS is now in this same file, so a `§ FEATURE SPECS` pointer here stays bare.

- [ ] **Step 2: Fix `docs/target-state/README.md`** (offsets are file-relative: source line − 1333)

| File line | Was | Becomes |
| --- | --- | --- |
| 5–6 | `§ Product features the spec promises and § Build sequence (original POC plan)` — both same-file, stay bare — then `§ Project Overview → Status is the authority` | `docs/context/project-overview.md § Project Overview → Status is the authority` |
| 8 | `subordinate to § Status wherever` | `subordinate to docs/context/project-overview.md § Project Overview → Status wherever` |
| 9 | `§ HTTP surface` | `docs/architecture/README.md § HTTP surface` |
| 27 | `Read § SERVICE ARCHITECTURE for what the app` | `Read docs/architecture/README.md § SERVICE ARCHITECTURE for what the app` |
| 50–51, 57 | `§ Planned agents → …` — same-file, stay | no change |
| 119 | `§ Tenant isolation, not here` | `docs/architecture/README.md § Tenant isolation` |
| 325 | `see § HTTP surface for the real contract` | `see docs/architecture/README.md § HTTP surface for the real contract` |
| 391 | `under Planned agents §1` — same-file | no change |

- [ ] **Step 3: Fix the context tree** (run `grep -n '§' docs/context/*.md` first; the map below covers every target seen in the measured census)

| File | Was | Becomes |
| --- | --- | --- |
| project-overview.md | `§ Pages and caching` / `§ SERVICE ARCHITECTURE → Pages and caching` | `docs/architecture/README.md § Pages and caching` / `docs/architecture/README.md § SERVICE ARCHITECTURE → Pages and caching` |
| architecture-context.md | `§ TARGET STATE` | `docs/target-state/README.md § TARGET STATE` |
| architecture-context.md | `§ File Organization` | `docs/context/code-standards.md § File Organization` |
| architecture-context.md | `§ HTTP surface …` | `docs/architecture/README.md § HTTP surface …` |
| architecture-context.md | `§ SERVICE ARCHITECTURE → Tenant isolation` | `docs/architecture/README.md § Tenant isolation` |
| ui-context.md | `§ SERVICE ARCHITECTURE → Verification` | `docs/architecture/README.md § Verification` |
| ui-context.md | `§ File Organization` | `docs/context/code-standards.md § File Organization` |
| ui-context.md | `§ Notation` | `AGENTS.md § Notation` |
| code-standards.md | `§ Architecture Context → System boundaries` | same-file? No — Code Standards and Architecture Context are separate files → `docs/context/architecture-context.md § Stack` decision: use `docs/context/architecture-context.md § Architecture Context → System boundaries` |
| code-standards.md | `§ TARGET STATE` | `docs/target-state/README.md § TARGET STATE` |
| code-standards.md | `§ SERVICE ARCHITECTURE → Pages and caching` | `docs/architecture/README.md § SERVICE ARCHITECTURE → Pages and caching` |
| code-standards.md | `§ STANDING RULES 13` | `AGENTS.md § STANDING RULES 13` |
| development-workflow.md | `§ APPLICATION BUILDING CONTEXT` | `docs/context/README.md` |
| development-workflow.md | `§ TARGET STATE` | `docs/target-state/README.md § TARGET STATE` |
| development-workflow.md | `§ STANDING RULES …` | `AGENTS.md § STANDING RULES …` |
| development-workflow.md | `§ SERVICE ARCHITECTURE` | `docs/architecture/README.md § SERVICE ARCHITECTURE` |
| development-workflow.md | `§ Architecture Context …` | `docs/context/architecture-context.md § Architecture Context …` |
| pm-conventions.md | `§ STANDING RULES (standing constraints)` | `AGENTS.md § STANDING RULES (standing constraints)` |

Same-file pairs that must stay bare (verified from the census): `§ Testing` inside code-standards.md, `§ UI Context` inside ui-context.md, `§ Pages and caching` inside architecture/README.md, `§ Verification` inside architecture/README.md, `§ Invariants` inside architecture-context.md, `§ Project Overview → Status` inside project-overview.md, `§ Development Workflow — Project appendix` inside development-workflow.md, `§ Border Radius` / `§ Trend Indicators` inside ui-context.md.

- [ ] **Step 4: Dead-pointer scan over the moved trees**

```bash
python3 - <<'EOF'
import re, pathlib
files = list(pathlib.Path("docs").rglob("*.md")) + [pathlib.Path("AGENTS.md")]
files = [f for f in files if "superpowers" not in f.parts]
headings = {f: {re.sub(r"\s+", " ", m.group(2)).strip()
                for m in re.finditer(r"^(#+) (.+)$", f.read_text(), re.M) for _ in [0]}
            for f in files}
dead = []
for f in files:
    for m in re.finditer(r"§ ([A-Z][^\s,;)`—→]+[a-z)S]?)", f.read_text()):
        name = m.group(1).strip().rstrip(".:”’")
        if any(name in h for h in headings[f]):     # resolvable in-file
            continue
        start = max(0, m.start() - 60)
        ctx = f.read_text()[start:m.start()]
        if re.search(r"(AGENTS\.md|docs/\S+\.md|README)\S*.*§", ctx) or "FILE.md" in ctx or "§ Heading" in name:
            continue                                 # already file-qualified, or a notation-table example
        dead.append((str(f), name))
print(dead or "clean")
EOF
```

Expected: `clean`, or only known-example noise — the § Notation table's `§ Heading` / `§ A → B` rows and `§` followed by digits (`§1`, `§2`, `§6`, `§7`). Anything else is a dead pointer: fix it, rerun.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: qualify cross-file § citations in the moved trees"
```

---

### Task 3: Rewrite `AGENTS.md` — keep rules, add the pointer map

**Files:**
- Modify: `AGENTS.md` (delete lines 117–1738 of the current file; keep 1–116 and 1739–1850; insert § Reference map; edit rule 14, § Notation, § When each section changes, § Completeness)
- Test: Steps 5–7 counts

**Interfaces:**
- Consumes: the trees from Tasks 1–2.
- Produces: `AGENTS.md` at ≈350 lines containing § Reference map — the single routing table every agent reads after the rules.

- [ ] **Step 1: Delete the moved ranges** — `# APPLICATION BUILDING CONTEXT` through the end of `# TARGET STATE` (file-relative: everything from the old line 117 up to the old line 1738). `# FEATURE SPECS` is NOT deleted here — it was extracted inside `docs/architecture/README.md`, so in `AGENTS.md` it is deleted and replaced by its pointer row. Keep `# VERIFICATION STANDARDS` and `# EDITING THIS FILE` intact.

- [ ] **Step 2: Insert the pointer block** after `## Project-specific rules — Rules 11–17`'s rule 17, before `# VERIFICATION STANDARDS`:

```markdown
# Reference map — where the detail lives

Rules 1–17 are binding. Everything below them routes through this table; a `§` in a docs file
names its own file per `AGENTS.md` § Notation. Read order (rule 14): the rules, then §
Reference map, then the file your task points at.

| Concern | File | Owns |
| --- | --- | --- |
| What is built vs not, goals, open product questions | `docs/context/project-overview.md` | § Project Overview |
| Stack, system boundaries, storage model, auth/tenancy, invariants | `docs/context/architecture-context.md` | § Architecture Context |
| Theme, tokens, typography, dashboard/UI patterns, layout, motion | `docs/context/ui-context.md` | § UI Context |
| General, TypeScript, Next.js, React, styling, API routes, data, file organization, testing conventions | `docs/context/code-standards.md` | § Code Standards |
| The per-unit loop, scoping, verification order, commands table | `docs/context/development-workflow.md` | § Development Workflow |
| Commit and PR conventions | `docs/context/pm-conventions.md` | § PM Conventions |
| Implemented surface: request path, tenant gate, HTTP surface, queue/cron, pages & caching, verification, repo skills | `docs/architecture/README.md` | § SERVICE ARCHITECTURE, § FEATURE SPECS |
| Design intent for what is NOT built — never cite as current behavior | `docs/target-state/README.md` | § TARGET STATE |

- `specs/` holds one file per deliverable unit (`specs/00-template.md`); `docs/superpowers/` holds
  dated design docs and plans. Dated records keep their old citations as history.
- A section describing a surface changes in the same commit that alters that surface —
  § EDITING THIS FILE now governs `AGENTS.md` and the three docs homes.
```

- [ ] **Step 3: Rewrite rule 14 in place** (read order; the `§ Notation` closing sentence stays):

```markdown
### 14. Read order
§ STANDING RULES → § Reference map. For architectural decisions, read `docs/context/` in table
order (Project Overview → Architecture Context → UI Context → Code Standards → Development
Workflow → PM Conventions). What exists: `docs/architecture/README.md` § SERVICE ARCHITECTURE;
what does not: `docs/target-state/README.md` § TARGET STATE. Per-unit feature specs live in
`specs/`. The rolling log at `docs/progress-tracker.md` is history, not required reading:
§ Project Overview → Status and § Open product questions decide what is current.
```

- [ ] **Step 4: Qualify the remaining `§` pointers in rules 12/13/15/16/17** — enumerate first, rewrite second, using the same targets as Task 2's map:

```bash
awk '/^# STANDING RULES/,/^# Reference map/' AGENTS.md | grep -n '§'
```

Expected: every hit either names rules 1–10/portable core (stays), names `§ Notation`/`§ EDITING THIS FILE`/`§ File Organization`-now-in-AGENTS.md-kept-headings, or gains a file name. `§ Service architecture` claims inside rule 15 become `docs/architecture/README.md`; "§ TARGET STATE" becomes `docs/target-state/README.md § TARGET STATE`; rule 13's "§ SERVICE ARCHITECTURE … table" becomes `docs/architecture/README.md § Verification`; rule 16's "`§ Tenant isolation`" reference becomes `docs/architecture/README.md § Tenant isolation`.

- [ ] **Step 5: Update `# EDITING THIS FILE`** — three edits:
  1. § Notation: after the two rules, append one line: "Inside a docs home a bare `§` means *that file*; every pointer into another home or into `AGENTS.md` names the file." (The existing rule already says this — the added line is the explicit extension to the split; do not delete the original rule 14 text it refers to. If the wording is already complete, SKIP this edit and say so in the commit body — no duplicate authority.)
  2. § When each section changes: add rows for `docs/context/*`, `docs/architecture/README.md`, `docs/target-state/README.md` carrying the same triggers the old `# SERVICE ARCHITECTURE` / `# TARGET STATE` / context bullets had; delete the now-impossible "SERVICE ARCHITECTURE moves out of TARGET STATE in the same commit" line and replace with "content moves between docs homes in the commit that made it true, and the § Reference map row updates in the same commit."
  3. § Completeness: restate checks with the split (see Step 6).

- [ ] **Step 6: Update § Completeness — the checks that work.** Replace checks 1, 2, 5, 6 with these and keep 3, 4 with their text unchanged except as noted:

```markdown
1. Every concern in § Reference map resolves to a file that exists:
   `sed -n '/^# Reference map/,/^# VERIFICATION/p' AGENTS.md | grep -oE '`docs/[^`]*`' | tr -d '`' | sort -u | while read -r f; do [ -e "$f" ] || echo "MISSING $f"; done`
   — expected: no output.
2. Every repo-rooted path cited in AGENTS.md or the docs homes resolves. Same command as before,
   run over `AGENTS.md docs/context/*.md docs/architecture/README.md docs/target-state/README.md`
   — expected: exactly the five not-exist paths (`lib/admin/http.ts` and the four unbuilt agents),
   now possibly cited from a docs file.
5. No raw-token utility outside the sentence that forbids it — run over AGENTS.md AND
   `docs/context/ui-context.md`, `docs/context/code-standards.md` — expected: the same two
   example lines only.
6. Self-citation census, now three commands:
   `git grep -c 'AGENTS\.md` §' AGENTS.md` → expected `0` (the portable-core note now reads
   "`AGENTS.md`" without a following `§` — rewrite it if the count is 1 and keep the meaning).
   `git grep -c 'docs/[a-z-]*/[A-Za-z-]*\.md §' AGENTS.md docs/context docs/architecture docs/target-state`
   → report the count; it is the qualified-pointer census, no fixed expected value (rule 4 of
   this very section forbids typing a census into the doc).
```

- [ ] **Step 7: Conservation spot-checks**

```bash
wc -l AGENTS.md                                  # expected ≈ 300–380, NOT 1850
grep -c '^#' AGENTS.md                           # report, no fixed expectation
grep -n 'APPLICATION BUILDING CONTEXT\|SERVICE ARCHITECTURE\|TARGET STATE' AGENTS.md | head
```

Expected for the last: hits only in § Reference map rows and the § STANDING RULES pointers rewritten in Step 4 — no orphaned section bodies.

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md keeps rules 1-17 and routes reference prose through a § Reference map"
```

---

### Task 4: Repair live external citations (dated records stay frozen)

**Files:**
- Modify: `README.md` lines 5, 6, 24, 54, 58
- Modify: `docs/conventions/feature-components.md` lines 27–28
- Modify: `specs/00-template.md` :36 · `specs/03-user-profile.md` :19 · `specs/08-app-shell.md` :32 · `specs/09-connections.md` :28
- Modify: `.claude/skills/development-workflow/SKILL.md` :10,34,41 · `.claude/skills/testing/SKILL.md` :15,73 · `.claude/skills/feature-component/SKILL.md` :29
- Test: Step 4's git-grep assertions

**Interfaces:**
- Consumes: final `AGENTS.md` + docs homes from Task 3.
- Produces: zero live files pointing at headings that no longer exist in `AGENTS.md`.

- [ ] **Step 1: Rewrite README.md** — exact replacements:
  - L5: `[AGENTS.md § Project Overview → Status](AGENTS.md#status)` → `[docs/context/project-overview.md § Project Overview → Status](docs/context/project-overview.md#project-overview)`; the `§ Notation` link `(AGENTS.md#notation)` is correct — AGENTS.md keeps § Notation.
  - L6: `[AGENTS.md § SERVICE ARCHITECTURE](AGENTS.md#service-architecture--implemented-surface)` → `[docs/architecture/README.md § SERVICE ARCHITECTURE](docs/architecture/README.md#service-architecture--implemented-surface)`; `[§ TARGET STATE](AGENTS.md#target-state)` → `[docs/target-state/README.md § TARGET STATE](docs/target-state/README.md#target-state)`.
  - L24: `Request path … : [AGENTS.md](AGENTS.md). Deep boundaries: [AGENTS.md § Architecture Context](AGENTS.md#architecture-context).` → `… : [docs/architecture/README.md](docs/architecture/README.md). Deep boundaries: [docs/context/architecture-context.md § Architecture Context](docs/context/architecture-context.md#architecture-context).`
  - L54: `then § APPLICATION BUILDING` context sentence → `then the § Reference map in [AGENTS.md](AGENTS.md) and the docs files it names`. Read the full sentence first and keep its shape.
  - L58: `AGENTS.md § Project Overview → Status and § Open product questions` → `docs/context/project-overview.md § Project Overview → Status and § Open product questions`.

- [ ] **Step 2: Rewrite docs/conventions and specs:**
  - feature-components.md L27: `§ SERVICE ARCHITECTURE → Verification` → `docs/architecture/README.md § Verification`.
  - specs/00-template.md L36: `AGENTS.md § FEATURE SPECS` → `docs/architecture/README.md § FEATURE SPECS`.
  - specs/03 L19 and specs/08 L32: `AGENTS.md § UI Context` → `docs/context/ui-context.md § UI Context`.
  - specs/09 L28: `AGENTS.md § STANDING RULES 15` → correct (stays).

- [ ] **Step 3: Rewrite the skills.** `.claude/skills/feature-component` and the four process skills are symlinks into `.agents/skills/` per § Repo skills — for each, `[ -L path ]` first and edit the REAL directory only:
  - development-workflow SKILL L10: "`AGENTS.md § STANDING RULES`, then the context sections" → "…then `AGENTS.md` § Reference map and the `docs/context/` files it names".
  - L34: "`AGENTS.md § TARGET STATE`" → "`docs/target-state/README.md` § TARGET STATE".
  - L41: "`§ SERVICE ARCHITECTURE` describes what now exists" → "`docs/architecture/README.md` § SERVICE ARCHITECTURE …".
  - testing SKILL L15: "`AGENTS.md § SERVICE ARCHITECTURE → Verification` owns the table" → "`docs/architecture/README.md` § Verification owns the table"; L73 "`§ Code Standards → Testing`" → "`docs/context/code-standards.md` § Code Standards → Testing".
  - feature-component SKILL L29: "the table in `AGENTS.md` § SERVICE ARCHITECTURE →" → "in `docs/architecture/README.md` §".
  - Do NOT touch `docs/superpowers/**` or `docs/progress-tracker.md` or `specs` design-doc §7 mentions — dated records, frozen citations.

- [ ] **Step 4: Assert no live dangling pointer to a moved heading**

```bash
git grep -n 'AGENTS\.md[ #(][^)]*§ \(Application Building Context\|APPLICATION BUILDING\|SERVICE ARCHITECTURE\|TARGET STATE\|Project Overview\|Architecture Context\|UI Context\|Code Standards\|Development Workflow\|PM Conventions\|FEATURE SPECS\|Verification\|HTTP surface\|Pages and caching\|Tenant isolation\|Repo skills\|File Organization\)' -- ':!docs/superpowers' ':!docs/progress-tracker.md' ':!supabase'
git grep -n 'AGENTS\.md#' -- ':!docs/superpowers' ':!README.md'
```

Expected: first command — no output (README anchors were rewritten in Step 1; anything left names `AGENTS.md § Notation`, `§ STANDING RULES`, `§ Reference map`, `§ EDITING THIS FILE` or `§ Completeness`, which stay). Second: no output outside README (whose Step 1 links are verified in Step 5).

- [ ] **Step 5: Verify every rewritten anchor and path by opening the target**

For each link introduced in Steps 1–3, run `ls` on the path and confirm the heading text exists: `grep -n '^#\+ <heading name>' <file>`. Report each as path + heading found; do not claim a rendered anchor works without the heading line existing.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/conventions specs .claude/skills .agents/skills
git commit -m "docs: repoint live citations from AGENTS.md headings to their docs homes"
```

(`git add` on a symlinked skill dir stages the real path; if it refuses "beyond a symbolic link", stage `.agents/skills/<name>/` directly — § Repo skills documents this.)

---

### Task 5: Gates, completeness, final census

**Files:** none modified — verification only.

- [ ] **Step 1: Re-run Task 2 Step 4's dead-pointer scan** over `AGENTS.md` + the three docs homes. Expected: `clean` (example-noise exceptions listed there).

- [ ] **Step 2: Run § Completeness checks 1–6 as rewritten** in Task 3 Step 6, from the repo root. Expected outputs exactly as each check's "Expected:" line; the § Notation self-citation check is now the `git grep -c 'docs/[a-z-]*/[A-Za-z-]*\.md §'` census — report the number, do not write it into any file.

- [ ] **Step 3: Run the gate chain**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all four green. Markdown edits cannot break them, but rule 13 is the authority on what gates a completion claim — quote each command's tail output in the report. If `pnpm test` skips, report the passed/skipped counts, not just the exit code.

- [ ] **Step 4: Read the result against § Project Overview → Status** — open `docs/context/project-overview.md` and confirm its § Status block still says what is current (this change altered no behavior, so it should read unchanged; if it references the old single-file layout, fix in this commit and note it).

- [ ] **Step 5: If Step 1–3 surfaced fixes, commit them**

```bash
git add -u AGENTS.md docs README.md specs
git commit -m "docs: close dangling citations from the AGENTS.md split"
```

Nothing to fix → no commit. Report: final `wc -l AGENTS.md`, the pointer census, gate outputs, and any § Completeness check whose expected value this change re-defined.

---

## Self-Review notes (written against this plan, pre-execution)

- Spec coverage: "keep rules 1–17, move the rest, each own directory, reference back" → Tasks 1–3; citation integrity → Tasks 2, 4, 5.
- Deliberate ruling embedded in the plan: `docs/architecture/` also holds `# FEATURE SPECS` (it is a 6-line pointer section, and § Verification's test-folder table is its consumer) — if the owner wants it in its own home instead, change Task 1's `w("docs/architecture/README.md", 1045, 1333)` upper bound to 1327 and extract 1328–1333 to `docs/feature-specs/README.md`, then adjust the § Reference map row and Task 4's specs/00-template fix.
- Known soft spots flagged for the executor, not placeholders: rule-12's § EDITING THIS FILE sentence refers to "everything below it — including `# SERVICE ARCHITECTURE`" — reword to "including the docs homes"; `docs/conventions/README.md` was checked this session and does not exist (directory holds only `feature-components.md`); Task 3 Step 6 check-2 path census may newly list paths that only ever lived in the moved prose — same five expected, but re-derive, don't assume.
- Heading demotion is limited to the six context files' top line (`## X` → `# X`) so citation names stay byte-identical; architecture and target-state READMEs need no demotion (their bodies already start at `#`).
