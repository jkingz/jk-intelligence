---
name: babysitting-a-pr
description: Use when watching a pull request after opening it - responding to AI review bots and human reviewer comments, clearing failing checks, keeping the branch current with main. Triggers on "watch the thread", "babysit this PR", "handle the review feedback", or whenever new PR comments or red checks appear.
---

# Babysitting a PR

**Core principle:** bot findings are leads, not evidence. Act only on items newer than your latest push, only after verifying them against the source, and only change what the verified finding requires.

## Loop

Pull state → apply the recency gate → verify surviving items → fix real ones, decline wrong ones → push (the new head re-sets the gate) → check `origin/main` → exit at a terminal state.

## Pull state

```bash
gh pr view <n> --json headRefOid,state,mergeable,statusCheckRollup,reviews,comments
gh pr checks <n>
gh api repos/<owner>/<repo>/pulls/<n>/comments \
  --jq '.[] | [.created_at, .user.login, .commit_id, .path, .line] | @tsv'
gh run view --job <id> --log-failed           # a red check
git fetch origin main && git log --oneline HEAD..origin/main
```

## Recency gate

Compare every item against the current `headRefOid` and its push timestamp before acting.

- Attached to a commit that isn't the head, or predates the last push → re-read the source. Already addressed: **no action, no comment** — not a reply, not a resolve, not "confirmed fixed".
- A bot that did not re-flag on the new head has withdrawn nothing; check the line yourself.
- A check run older than the head proves nothing either way; wait for or re-run it.
- A passing check carrying a warning annotation is not a finding. Blast radius zero until something demands a change.

## Verify against the source

Read the exact `path:line`. Grep the real call sites. Reproduce a red check with the command CI ran. If you cannot name the line or command that proves it, you have not verified it.

Never invent a threshold, project rule, or precedent ("we act at 1 kB", "PR #9 merged with this") to justify changing or ignoring something. Point at it, or drop the claim.

## Separate yours from the repo's

A CI failure is yours only if `origin/main` is green at that step. Failing-before-your-branch, flaky-on-rerun, and unrelated-suite failures get **reported, not fixed here**. Repairing main inside a feature PR is the same violation as scope creep.

## Do not scope creep (hard rule)

The fix's blast radius equals the finding's blast radius. No drive-by cleanup: renames, logger or format swaps, comment rewording, "while I'm here" extractions. No new abstraction, dependency, flag, test surface, or compat shim for a case nobody hit. Don't rewrite the PR body or open issues unless asked.

Out-of-scope observations go in **one line to your partner** — not in code, not in the thread.

| Temptation | Reality |
| --- | --- |
| "The bot's suggestion is bigger than its finding, so refactor properly" | Fix the reported defect. The rest is a separately approved proposal. |
| "This nearby `console.log` / dead code is trivial" | Trivial × every PR = an unreviewable diff. Report it. |
| "Reviewers will expect the DI/cache/typing work anyway" | Predicted taste is not a requirement. |
| "One more commit while I'm here saves a round trip" | It re-opens the gate and invalidates your own verification. |

## Do not post filler (hard rule)

**REQUIRED:** every comment, reply, and status note goes through `leaving-pr-comment` — its triggers, body contract, and mandatory AI disclaimer. It exists for this failure; do not ad-hoc a comment.

Zero comments is the usual outcome: a verified-and-fixed finding is answered by the push itself. Where a finding is genuinely not worth addressing, post the written decline through that skill and **resolve the thread** — don't leave it hanging, don't ignore it silently.

## Keep current with main

Rebase only when one is true: main has commits touching your files; a check fails from staleness or `mergeable: DIRTY`; your partner asks. `git rebase origin/main`, resolve by preserving both intents, `git push --force-with-lease`. Never `--no-verify`, never bypass a hook — fix the cause.

## Exit states

| State | Do |
| --- | --- |
| **Ready** | Everything newer than the head handled, checks green, branch current. Report. Merge only if merging was authorized. |
| **Blocked** | Need a decision, access, or a reviewer correction. Ask, then stop. |
| **Obsolete** | An overlapping PR on main covers this work: **stop monitoring** and **ask before closing** unless closing was explicitly authorized. Branch stays intact. Don't "win" the conflict by rebasing duplicate work onto main. The report goes to your partner, **not** the thread — comment on the PR only if a human is actively reviewing there. |

## Monitoring

If the harness can schedule runs, use it so you react when comments arrive. In Qoder: `qoder_cron` with `action: add`, `schedule.kind: "every"` at ≥10 min, a self-contained prompt naming the PR number and this skill, and `expiresAt` at the terminal deadline; `update` rather than adding a duplicate, `remove` at exit. Otherwise poll on request and report. Never claim a background loop the harness cannot keep.

**Red flags — stop:** commenting on a finding you have not re-read in the source; replying to an outdated bot comment; "also" in a fix commit message; a threshold you cannot cite; rebasing a PR you suspect is obsolete; closing without asking; a comment whose whole content is "done".
