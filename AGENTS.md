<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — product definition, goals, features, and scope
2. `context/architecture-context.md` — system structure, boundaries, storage model, and invariants
3. `context/ui-context.md` — theme, colors, typography, canvas design, and component conventions
4. `context/code-standards.md` — implementation rules and conventions
5. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
6. `context/progress-tracker.md` — current phase, completed work, open questions, and next steps

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing.

## Core Agents (Autonomous Processes)

### 1. API Sync Agent
**Responsibility:** Daily data retrieval from all sources
- Pulls from: GSC, GA4, SEO platform APIs (Semrush/Ahrefs/Moz)
- Runs: Daily cron (configurable per client)
- Handles: OAuth token refresh, retry logic, partial failures
- Output: Raw data → normalized format → Supabase

**Tech Stack:**
- Node.js background job (Bullmq queue on Redis)
- Environment-based API credentials per client
- Exponential backoff retry (3-5 attempts)
- Circuit breaker after N consecutive failures

---

### 2. Data Transform Agent
**Responsibility:** Normalize API responses into dashboard schema
- Input: Raw API data (varies by source)
- Transform: Standardize metrics (clicks, impressions, rankings, conversions)
- Validate: Schema compliance, missing data flags
- Output: Historical snapshots + current state

**Tech Stack:**
- Dedicated transform layer (typed functions)
- TypeScript for schema validation
- Logs transformation errors separately

---

### 3. Cache/Freshness Agent
**Responsibility:** Manage stale-data flags & fallbacks
- Monitors: Last sync time for each data source per client
- Flags: "data_is_stale" if sync missed > 24hrs
- Fallback: Serves cached data + warning banner
- Cleanup: Archive old snapshots weekly

**Tech Stack:**
- Redis for TTL management
- Supabase event triggers on sync success/fail

---

### 4. Auth & Access Control Agent
**Responsibility:** Validate client sessions, enforce data isolation
- OAuth: Google login (Supabase Auth)
- Row-Level Security (RLS): Supabase policies block cross-client access
- Admin: Separate role for staff → full visibility

**Tech Stack:**
- Supabase Auth + JWT
- Database policies (SQL-based RLS)

---

### 5. Reporting Generation Agent (Optional/Phase 2)
**Responsibility:** AI-powered insight summaries
- Input: Client's current + historical metrics
- Claude API call: "Summarize ranking changes, top gains/losses"
- Output: Plain-English insights → dashboard widget
- Cache: Don't regenerate daily (expensive)

**Tech Stack:**
- Claude API integration
- LLM prompt templates per report type

---

## Agent Interaction Map

```
[External APIs]
     ↓
[API Sync Agent] → [Data Transform Agent] → [Supabase DB]
     ↓                                            ↓
[Cache/Freshness Agent] ← ← ← ← ← ← ← ← ← ← ← ↓
     ↓
[Next.js Client] ← [Auth & Access Control] ← [Supabase RLS]
     ↓
[Dashboards + Insights]
```

---

## Deployment Strategy

**Sync Agents:** Vercel Functions (scheduled) OR separate Node.js worker (AWS Lambda/Railway)
**Web App:** Next.js on Vercel
**Database:** Supabase (PostgreSQL)
**Auth:** Supabase Auth
**Cache:** Redis (Upstash or self-hosted)
**Logging:** Structured logs → Supabase table or external service (LogTail)

---

## Error Handling Per Agent

| Agent | Failure Mode | Behavior |
|-------|--------------|----------|
| API Sync | API down | Retry 3x, mark stale, alert admin |
| Transform | Invalid schema | Log error, keep cached data, email ops |
| Cache | Redis down | Fallback to DB queries (slower) |
| Auth | OAuth fail | User sees login error, session preserved |
| Reporting | Claude API timeout | Show "insights unavailable" instead |

Be very concise, sacrifice grammar for the sake of concision.
