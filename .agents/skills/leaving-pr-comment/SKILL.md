---
name: leaving-pr-comment
description: Use before posting anything to a GitHub pull request or issue thread - replying to review bots, answering reviewer feedback, declining a finding, or reporting thread status. Sets the required body format and AI-authorship disclaimer and stops filler comments.
---

# Leaving a PR comment

**Core rule:** a comment must carry a payload the thread did not already have. If yours would only say "done", "ack", "good point", or restate what the push already shows — do not post. Silence is a correct end state, and the common one.

## Post only when one of these is true

1. You are **declining** a finding and the reason is a judgment the author needs to see.
2. You need something only a human can give: a decision, access, or a correction of the reviewer's premise.
3. Your partner asked for a status report on the thread.
4. The work spans more than one push and the thread would otherwise misread what landed.

Anything else: no comment.

## Body contract — these parts, in this order

```markdown
> [!NOTE]
> Written by an AI agent on behalf of @<handle>. Verify independently.

**<verdict>** — fixed | declined | question | superseded

<evidence: file:line, check name, or commit SHA you actually read>

<what changed, or why not> ← omit for `question`
```

- Six lines of body or fewer. No headings, no sections, no emoji beyond the callout.
- The disclaimer is **mandatory and always first**. No exception for one-liners.
- `<handle>` is a real login — `gh pr view <n> --json author --jq .author.login`. Angle brackets in a shipped comment are a bug.
- One comment per finding. Never paste the bot's text back at it.
- Reply inside the review thread, not top-level:

  ```bash
  gh api repos/{owner}/{repo}/pulls/<n>/comments/<id>/replies \
    --method POST -F body=@- <<'EOF'
  <the body, exactly as contracted>
  EOF
  ```

  `-F body=@-` reads the body from stdin, so nothing shell-expands into it and backticks in code spans survive.
- Top-level instead: `gh pr comment <n> --body-file <file>`, only for trigger 3 or 4.

## Declining

State the reason as a checkable claim, then stop: "Not acting: nothing calls this route (`rg -l getClient` → 0 hits)." Offer a home for it only if filing was authorized. No debate, no apology, no "happy to revisit".

## Never

- Agreement language ("Great catch", "You're absolutely right") — the fix *is* the reply.
- A comment with no disclaimer.
- "PTAL", "bumping", "still looking", CI retry noise, or narrating a re-run.
- `@`-mentioning anyone unless your partner said to.
- Resolving someone else's thread to make it quiet.
