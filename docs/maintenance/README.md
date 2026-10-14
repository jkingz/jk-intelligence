# EDITING THE AGENT DOCS

`AGENTS.md` and the docs homes are hand-maintained. `next dev` writes one thing: the text between
`<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` at the top of `AGENTS.md`.
`upsertAgentRulesBlock()` in `node_modules/next/dist/server/lib/generate-agent-files.js`
(Next 16.3.5) replaces that span and nothing else, so everything below it — `AGENTS.md`'s
`# STANDING RULES` and `# Reference map`, and every docs home — is hand-maintained and never arrives
by generation. Commit the marker block with your work rather than deleting it.

Any section that describes a surface changes in the same commit that alters that surface — a doc that
waits for a later cleanup commit is describing a state that no longer exists in the meantime.

## Notation

`§` is this repo's section marker, and it is used well outside these docs — in `README.md`, `specs/`,
`docs/conventions/`, the repo skills, code comments and `.github/workflows/ci.yml`. It is a citation,
not stray punctuation, so it is never a cleanup target. Five forms:

| Form | Reads as | Live example |
| --- | --- | --- |
| `` `FILE.md` § Heading `` | that heading in that named file | `` `docs/progress-tracker.md` § Completed `` |
| `§ Heading`, no file named | that heading in the file being read | `§ Notation` — this section |
| `§ A → B` | subsection `B` inside section `A` | `§ Project Overview → Status` |
| `§ A <n>` | numbered item `<n>` of section `A` | `` `docs/conventions/project-rules.md` § PROJECT RULES 13 `` |
| `<doc> §<n>` | numbered section `<n>` of a named spec or design doc | `Spec §6`, `Planned agents §1` |

Two rules follow from the second row:

- A bare `§` means *the file you are reading*. Cite the file you are reading's own sections bare,
  never prefixed with its name. § Completeness check 6 counts the prefixed form in `AGENTS.md` and
  expects exactly one hit: the portable-core note at the top of `AGENTS.md` § STANDING RULES, which
  is talking about *another* project's copy. A citation that crosses files names the file, or it is
  unreadable from anywhere else.
- A `§` left pointing at a renamed or deleted heading is a dead pointer, fixed in the commit that
  moved it — **except inside a dated record.** `docs/progress-tracker.md`'s dated entries, the plans
  and specs under `docs/superpowers/`, and the applied migrations in `supabase/migrations/` are
  history: their citations stay exactly as written even when they name a file that no longer exists
  (`RULES.md`, `context/*`), because repairing a record is falsification. `docs/conventions/project-rules.md`
  § PROJECT RULES 16 states the migration half of that on its own.

## When each section changes
- **`AGENTS.md` § STANDING RULES** — when a portable rule 1–10 changes, or the reverse. Not when a feature ships. Those rules are copied verbatim into other repos' `AGENTS.md`, so change every copy together.
- **`docs/conventions/project-rules.md` § PROJECT RULES** — when a project rule 11–17 changes, and not when a feature ships.
- **`AGENTS.md` § Reference map** — when a docs home is added, renamed or moved; that table names it.
- **`docs/context/`** — Project Overview / Architecture Context when a decision is made, before the
  code exists; UI Context / Code Standards / Development Workflow / PM Conventions when the practice
  they prescribe changes, not when a feature ships.
- **`docs/architecture/README.md` § SERVICE ARCHITECTURE** — implemented code only. When something
  becomes true, move it out of `docs/target-state/README.md` in the same commit that made it true.
- **`docs/architecture/README.md` § Repo skills** — when a skill is added, removed or re-linked. Its counts are
  a dated filesystem measurement, so re-measure with `readlink` and `git ls-files -s` rather than
  editing a number.
- **`docs/target-state/README.md` § TARGET STATE** — whenever intent outpaces implementation. Never
  cite it as current behavior.
- **`docs/architecture/README.md` § FEATURE SPECS** — when `specs/` gains or loses a numbered file,
  or the split with `docs/superpowers/specs/` changes.
- **§ VERIFICATION STANDARDS** — when an inline correction closes a failure mode: delete its row rather
  than leaving a second authority.
- **§ EDITING THE AGENT DOCS** — when a docs home is added, renamed or moved, this list and that table
  name it.
- **specs/** — one file per deliverable unit. `specs/00-template.md`.

# VERIFICATION STANDARDS — Quality guardrails

A sentence earns its place in these docs only if its author read the thing this session. These are the
failure modes no inline correction has closed yet.

| Bad line | Why it is wrong | Good line |
| --- | --- | --- |
| "60 tests passing." | A count rots the day someone adds a test — and `RULES`-era docs here carried exactly that kind of stale number. | Run the command, quote its output in the reply, type nothing into the doc. |
| "Integration tests pass." | The tier can collect nothing and still exit 0. `docs/conventions/project-rules.md` § PROJECT RULES 13 owns the file list and the `skipIf` mechanism — this row adds no rule, only the phrasing. | "integration tier: N passed, 0 skipped" — or say it skipped for want of `TEST_*` names. |
| "Build passes locally and in CI." | The build once fetched Geist from `fonts.googleapis.com` at build time, which a sealed runner cannot reach; the first CI run was red on it and the fix was to vendor the fonts. | Name the probe: `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build`. It passes here because `app/fonts/` and `lib/exports/fonts/` are vendored. |

## Completeness — the checks that work
No slot grep. The template's `grep -n '<[a-zA-Z_/]' AGENTS.md` cannot run against a filled file:
`<clientId>`, `<CRON_SECRET>` and `<type>(<scope>)` are real text here, so it reports noise forever
and trains people to ignore a gate. Every check below therefore has a stated expected result on the
files as they stand — a check whose expected output is "some noise you learn to skip" is the same
defect wearing a different name.

1. Every concern in `AGENTS.md` § Reference map resolves to a file that exists. Run:

   ```bash
   grep -oE '`docs/[^`]*`' AGENTS.md | tr -d '`' | sort -u \
     | while read -r f; do [ -e "$f" ] || echo "MISSING $f"; done
   ```

   Expected: no output. Whole-file rather than a heading range: a range anchored on a neighbouring
   heading over-scans silently the day that heading moves, and one of them has moved. The heading
   names in that table's third column are confirmed by check 1's sibling, the heading census: run
   `grep -n "^# \|^## "` over `AGENTS.md` and each docs home and match the rows by eye.
2. Every repo-rooted path cited in `AGENTS.md`, the docs homes or a skill this repo authors resolves. Run:

   ```bash
   grep -ohE '(app|components|lib|tests|types|specs|docs|scripts|supabase|patches|\.github)/[]A-Za-z0-9_./{}()[-]*\.(ts|tsx|css|md|sql|json|mjs|ya?ml)' \
     AGENTS.md docs/context/*.md docs/architecture/README.md docs/target-state/README.md docs/maintenance/README.md \
     .claude/skills/{babysitting-a-pr,development-workflow,feature-component,git-workflow,leaving-pr-comment,playwright-cli,testing,verification-gates}/SKILL.md \
     | grep -v '\*' \
     | sort -u \
     | while read -r p; do git ls-files --error-unmatch "$p" >/dev/null 2>&1 || echo "$p"; done
   ```

   Expected: exactly the five paths cited in order to say they do *not* exist —
   `lib/admin/http.ts` and `lib/agents/syncAgent.ts` / `transformAgent.ts` / `cacheAgent.ts` /
   `insightsAgent.ts` (now living in the docs homes). A sixth line is a dead pointer. A candidate
   containing `*` is a shell glob and not a path, so it is dropped before the check — the commands in
   this section are full of them, starting with the one above. Bare basenames (`guard.ts`) and
   `node_modules/…` paths are outside this command's reach; check those by opening the file, because a
   whole-file grep over them produces the noise this section refuses to generate.

   The skill list is the eight whose bytes sit in real directories under `.claude/skills/`, not all
   seventeen; `docs/architecture/README.md` § Repo skills names them and gives the mirror. The other nine
   are vendored through `skills-lock.json`, which reinstalls over any edit, so their internal pointers are
   not this repo's to repair: `code-review` cites an issue-tracker doc that its own upstream setup command
   is meant to create, and the `supabase` skills' guide URLs feed this command's `docs/` alternative as path
   fragments. Measured 2026-10-15: widening to all seventeen printed five such lines on top of the five
   above, which is the noise this section refuses to generate. `playwright-cli` is inside the eight because
   it is committed here, though the installer owns its bytes — see
   `docs/architecture/README.md` § Repo skills before editing it.
3. Every command cited here, in the docs homes, or in the eight skills of check 2 is real. `pnpm run` lists the scripts, but a `pnpm <verb>` form outside
   that list is not covered by it. Enumerate those with `grep -ohE 'pnpm (exec|dlx|patch|patch-commit|add|install|remove)'` run over the same
   file list as check 2 | sort -u — expected
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
   never prefixed with that file's own name. Run
   ``git grep -c 'AGENTS\.md` §' AGENTS.md`` — expected `1`: the portable-core note at the top of
   `AGENTS.md` § STANDING RULES, which names *another* project's copy; a second hit is a citation
   that should have been written bare. Then run
   ``git grep -c 'maintenance/README\.md` §' docs/maintenance/README.md`` — expected no output at all,
   because every file named in this one is a different file. The `\.` in each pattern is what keeps
   this check's own text from matching itself.
