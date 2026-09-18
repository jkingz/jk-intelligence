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

# AGENTS & SERVICE ARCHITECTURE

## Core Agents (Autonomous Processes)

### 1. API Sync Agent (`lib/agents/syncAgent.ts`)
**Responsibility:** Daily data retrieval from all sources
- Pulls from: GSC, GA4, SEO platform APIs (Semrush/Ahrefs)
- Runs: 2 AM daily via BullMQ queue (triggered by Vercel cron)
- Handles: OAuth token refresh, retry logic, partial failures
- Input: clientId, API credentials from Supabase Vault
- Output: appended metrics_snapshots rows + updated current_metrics cache

**Tech Stack:**
- BullMQ queue (replaces Bull, Redis-backed)
- Upstash Redis for queue storage
- Promise.allSettled for parallel API calls (partial failure safe)
- Exponential backoff retry (3 attempts per source: 1s → 4s → 16s)
- Circuit breaker after 5 consecutive failures per client, pause sync + alert admin

**Implementation:**
```ts
// lib/agents/syncAgent.ts
export async function syncClient(clientId: string) {
  try {
    const creds = await getClientCredentials(clientId) // Supabase Vault
    const [gsc, ga4, semrush] = await Promise.allSettled([
      syncGSC(creds.gsc_token),
      syncGA4(creds.ga4_token),
      syncSemrush(creds.semrush_api_key)
    ])
    // handle each result independently
    const normalized = await transformData(gsc, ga4, semrush)
    await insertSnapshots(clientId, normalized)
    await updateCurrentMetrics(clientId, normalized)
    await logSync(clientId, 'success', records.length)
  } catch (error) {
    await handleSyncFailure(clientId, error)
  }
}
```

---

### 2. Data Transform Agent (`lib/agents/transformAgent.ts`)
**Responsibility:** Normalize API responses into dashboard schema
- Input: Raw API data from GSC, GA4, Semrush (varies by source)
- Transform: Standardize to MetricSnapshot interface
- Validate: Zod schema validation, log errors separately
- Output: Normalized array of snapshots + current_metrics updates

**Tech Stack:**
- Zod for schema validation (typed, strict)
- TypeScript interfaces: MetricSnapshot, KeywordRanking
- Separate error logging (log transformation failure, don't block sync)

**Implementation:**
```ts
// lib/agents/transformAgent.ts
import { z } from 'zod'

const MetricSnapshotSchema = z.object({
  clientId: z.string().uuid(),
  date: z.string(),
  platform: z.enum(['gsc', 'ga4', 'semrush']),
  metricType: z.enum(['organic_traffic', 'conversions', 'clicks', 'impressions', 'ctr', 'position']),
  value: z.number(),
  metadata: z.record(z.unknown()).optional(),
})

export async function transformData(gsc, ga4, semrush) {
  const snapshots = []
  try {
    snapshots.push(...transformGSC(gsc))
    snapshots.push(...transformGA4(ga4))
    snapshots.push(...transformSemrush(semrush))
  } catch (err) {
    logTransformError(err)
  }
  return snapshots.map(s => MetricSnapshotSchema.parse(s))
}
```

---

### 3. Cache/Freshness Agent (`lib/agents/cacheAgent.ts`)
**Responsibility:** Manage stale-data flags & fallbacks
- Monitors: Last sync time per client per source (Upstash Redis TTL)
- Flags: is_stale = true if sync missed > 24hrs
- Fallback: Serves cached data from current_metrics + warning banner
- Cleanup: old snapshots archived weekly (separate job)

**Tech Stack:**
- Upstash Redis for TTL management (key: `stale:{clientId}:{platform}`)
- Supabase current_metrics table stores is_stale flag
- Dashboard reads is_stale from DB (client never computes staleness)

**Implementation:**
```ts
// lib/agents/cacheAgent.ts
export async function markStale(clientId: string, platform: string) {
  const key = `stale:${clientId}:${platform}`
  await redis.setex(key, 86400, '1') // 24hr TTL
  await supabase
    .from('current_metrics')
    .update({ is_stale: true })
    .eq('client_id', clientId)
    .eq('platform', platform)
}

export async function checkStale(clientId: string, platform: string) {
  const key = `stale:${clientId}:${platform}`
  return !!(await redis.exists(key))
}
```

---

### 4. Auth & Access Control Agent (`lib/agents/authAgent.ts`)
**Responsibility:** Validate client sessions, enforce data isolation
- OAuth: Google login via Supabase Auth
- Row-Level Security (RLS): Supabase policies block cross-client access (enforced at DB layer, not bypassable)
- Roles: admin (full access) | client (own data only) | staff (assigned clients)
- Session: JWT token from Supabase Auth

**Tech Stack:**
- Supabase Auth + Google OAuth
- Supabase JWT tokens (sub claim = user ID, role claim = admin|client|staff)
- Database policies (SQL-based RLS) on every exposed table

**Implementation:**
```ts
// lib/agents/authAgent.ts
export async function enforceClientAccess(req: Request, clientId: string) {
  const user = await getAuthUser(req) // from Supabase JWT
  if (!user) return unauthorized()
  
  // Admin sees all
  if (user.role === 'admin') return true
  
  // Client sees only own data
  if (user.role === 'client' && user.client_id === clientId) return true
  
  return forbidden()
}
```

**RLS Policies:**
```sql
-- metrics_snapshots: clients see only their data
CREATE POLICY "clients_see_own_metrics" ON metrics_snapshots
  FOR SELECT USING (client_id = (SELECT client_id FROM users WHERE id = auth.uid()));

-- admins see all
CREATE POLICY "admins_see_all" ON metrics_snapshots
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
```

---

### 5. AI Insights Agent (`lib/agents/insightsAgent.ts`)
**Responsibility:** AI-powered insight summaries
- Input: current_metrics + last 30-day metrics_snapshots for client
- Claude API call: summarize ranking changes, top gains/losses, focus areas
- Output: plain-English insights cached in current_metrics as `ai_summary` metric
- Cache: cached 24hrs (don't regenerate every request, cost control)

**Tech Stack:**
- Claude API (claude-sonnet-4-6 model)
- Prompt template per insight type (ranking summary, traffic analysis, etc.)
- Upstash Redis cache for response

**Implementation:**
```ts
// lib/agents/insightsAgent.ts
export async function generateInsights(clientId: string) {
  const cacheKey = `insight:${clientId}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)
  
  const metrics = await getClientMetrics(clientId)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize performance: ${JSON.stringify(metrics)}`
      }]
    })
  })
  
  const insight = await response.json()
  await redis.setex(cacheKey, 86400, JSON.stringify(insight))
  return insight
}
```

---

## Agent Interaction Map

```
[Vercel Cron: 2 AM daily]
     ↓
[POST /api/cron/sync] 
     ↓
[BullMQ Queue: Queue sync job per active client]
     ↓
[syncAgent(clientId)]
  ├─ Fetch creds from Supabase Vault
  ├─ Promise.allSettled([GSC, GA4, Semrush])
  │    ├─ GSC → transformAgent → normalize
  │    ├─ GA4 → transformAgent → normalize
  │    └─ Semrush → transformAgent → normalize
  ├─ insertSnapshots(clientId, normalized)
  ├─ updateCurrentMetrics(clientId, normalized)
  ├─ cacheAgent.markStale(clientId, platform)
  └─ logSync(clientId, status, error)
     ↓
[Supabase: metrics_snapshots + current_metrics updated]
     ↓
[Dashboard reads from current_metrics (fast)]
     ↓
[UI checks is_stale flag → shows stale banner if true]
     ↓
[User requests insights → insightsAgent(clientId)]
     ↓
[Claude API generates summary, cache 24hrs]
```

---

## Deployment Strategy

| Service | Provider | Purpose |
|---------|----------|---------|
| Next.js App | Vercel | Frontend + API routes |
| Database | Supabase | Postgres: metrics, clients, creds, logs |
| Queue | BullMQ + Upstash Redis | Job processing, retry, circuit breaker |
| Cron Trigger | Vercel Functions | POST /api/cron/sync @ 2 AM daily |
| Credentials | Supabase Vault | Encrypted API keys, not in .env |
| Auth | Supabase Auth | Google OAuth, JWT tokens |
| Logging | Supabase table | sync_logs for audit trail |
| Cache | Upstash Redis | Stale flags, AI insight cache |

---

## Error Handling Per Agent

| Agent | Failure Mode | Behavior |
|-------|--------------|----------|
| API Sync | API down | Retry 3x (1s → 4s → 16s), mark stale, log error, continue with other APIs |
| API Sync | 5+ consecutive failures | Pause client sync, fire circuit breaker, alert admin |
| Transform | Invalid schema | Log error, discard bad row, continue (partial insert) |
| Cache | Redis down | Fallback to direct DB queries (slower), continue sync |
| Auth | Session expired | Redirect to login, preserve session state in localStorage |
| Insights | Claude timeout | Show "insights unavailable" widget, no crash |
| Cron | Job queue full | Retry job next run (BullMQ handles backpressure) |

**Logging Pattern:**
```ts
// Never log credentials
await logSync({
  clientId,
  platform, // 'gsc' | 'ga4' | 'semrush'
  status, // 'success' | 'partial' | 'failed'
  error: sanitizedMessage, // no API keys
  recordsSynced: count,
  durationMs: elapsed,
  createdAt: new Date()
})
```

---

## API Route Definitions

### Cron Trigger
```
POST /api/cron/sync
Authorization: Vercel cron secret
Body: { secret: VERCEL_CRON_SECRET }
Response: { queued: number, errors: [] }

Purpose: Vercel cron calls this @ 2 AM daily. Queues sync job per active client.
```

### Manual Sync Trigger (Admin)
```
POST /api/sync/trigger
Authorization: Bearer JWT (admin only)
Body: { clientId: string }
Response: { jobId: string, status: 'queued' }

Purpose: Admin manually trigger sync for one client.
```

### Metrics Read (Client/Admin)
```
GET /api/metrics/{clientId}
Authorization: Bearer JWT
Query: ?days=30 (optional, defaults to last 30)
Response: { data: current_metrics[], is_stale: bool, last_updated: timestamp }

Purpose: Dashboard loads current metrics fast (from current_metrics cache).
```

### Metrics History (Client/Admin)
```
GET /api/metrics/{clientId}/history
Authorization: Bearer JWT
Query: ?start=2024-01-01&end=2024-01-31&metric_type=organic_traffic
Response: { data: metrics_snapshots[], metadata: {} }

Purpose: Fetch historical trends for date range comparison.
```

### Sync Logs (Admin)
```
GET /api/sync/logs/{clientId}
Authorization: Bearer JWT (admin only)
Query: ?limit=20
Response: { data: sync_logs[], total: number }

Purpose: View sync history and failure reasons.
```