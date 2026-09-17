# Development Workflow

## Approach

Build incrementally using spec-driven workflow. Context files define what to build, how to build it, current progress. Always implement against specs — never infer or invent behavior.

Context files:
- `architecture-context.md` — stack, boundaries, storage, auth model
- `agents.md` — sync, transform, cache, auth agent contracts
- `code-standards.md` — TypeScript, Next.js, styling, file org rules
- `ui-context.md` — tokens, components, layout patterns
- `progress-tracker.md` — current state of implementation

---

## Scoping Rules

- One feature unit or agent at a time.
- Small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in one step.

---

## When To Split Work

Split if a step combines any of:

- UI changes + sync agent changes
- DB schema changes + API route changes
- Multiple unrelated agents (e.g. cache agent + auth agent)
- Cron/queue changes + dashboard changes
- Behavior not clearly defined in context files

If end-to-end verification isn't quick — scope is too broad, split it.

---

## Implementation Order (POC)

Follow this sequence. Do not skip ahead.

```
1. DB schema + migrations (Supabase)
2. Supabase Auth + Google OAuth + RLS policies
3. API credentials model (Vault integration)
4. GSC sync agent (fetch → transform → store)
5. GA4 sync agent
6. Semrush/Ahrefs sync agent
7. BullMQ queue + cron endpoint
8. current_metrics cache layer + is_stale logic
9. /api/metrics route (read from cache)
10. Dashboard UI (metric cards, trends, date range)
11. Stale data banner + last_updated display
12. Admin panel (add client, manage credentials, view logs)
13. AI insight generation (Claude API)
14. CSV/PDF export
```

Each step must be verified before moving to the next.

---

## Handling Missing Requirements

- Do not invent behavior not defined in context files.
- Ambiguous requirement → resolve in relevant context file first.
- Missing requirement → add as open question in `progress-tracker.md` before continuing.

---

## Protected Foundation Components

Do not modify unless explicitly instructed:

- `components/ui/*` (shadcn/ui)
- `lib/supabase/*` (client construction)
- Third-party library internals

Project-specific logic goes in app-level components and `lib/agents`, `lib/db`, `lib/queue`. Never patch foundation files to make a feature work.

---

## Keeping Docs In Sync

Update relevant context file when any of these change:

- System boundaries or storage model
- Agent contracts or error handling behavior
- API route shapes
- Code conventions
- Feature scope (in or out)

`progress-tracker.md` reflects actual state — not intended state.

---

## Agent Development Rules

- Build and test each agent in isolation before wiring into queue.
- Mock external API responses during development (realistic dummy data).
- Verify partial failure handling: kill one mock API, confirm others still write.
- Confirm circuit breaker fires after 5 consecutive failures.
- Confirm is_stale flag set correctly when sync misses 24hr window.

---

## Before Moving To Next Unit

1. Current unit works end to end within defined scope.
2. No invariant from `architecture-context.md` violated.
3. `progress-tracker.md` updated to reflect completed work.
4. No console errors, no TypeScript errors, no unhandled promise rejections.
5. Sync agent: confirm data visible in Supabase table after run.
6. Dashboard: confirm stale banner shows when cache is expired.