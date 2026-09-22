# Target-state architecture (not implemented)

Moved out of `AGENTS.md` on 2026-09-23 so the root instructions describe only code that exists.
Everything here is **design intent**: unverified against the running app, and each item needs its
own build + test pass before it can be cited as fact.

Verified status at move time:
- `lib/agents/` contains `authAgent.ts` only. `syncAgent`, `transformAgent`, `cacheAgent`,
  `insightsAgent` do not exist.
- `lib/queue/worker.ts` consumes `seo-sync` and returns `status: "mock_completed"` — it performs no
  external fetch and writes no rows.
- `persistMetrics`, `markMetricsStale` and `writeSyncLog` in `lib/db/repository.ts` have zero
  callers; `api_credentials` is never read. Dashboard data currently comes from `scripts/seed.mjs`.
- No deployment host runs the worker. Vercel provides only the cron (`vercel.json`: `0 2 * * *` →
  `GET /api/cron/sync`), so enqueued jobs have no consumer in production.

Routes below marked "planned" are absent from `app/api/`. Read `AGENTS.md` → "Implemented surface"
for what the app actually serves.

---

## Planned agents

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

## Planned API Route Definitions

Only `/api/cron/sync` is implemented, and as `GET` (Vercel cron sends no body) — see `context/architecture-context.md` for the real contract. The `POST` shape below is the original spec, kept for reference.

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

---

## Build sequence (original POC plan)

Kept as the dependency order for the unbuilt parts. Marked against the code as of 2026-09-23 — re-verify before trusting a line.

1. ✅ DB schema + migrations — three files under `supabase/migrations/`.
2. ✅ Supabase Auth + Google OAuth + email/password + RLS policies.
3. ⚠️ API credentials model — `api_credentials` holds a `vault:<uuid>` reference and RLS denies select; nothing resolves the reference.
4. ⬜ GSC sync agent (fetch → transform → store).
5. ⬜ GA4 sync agent.
6. ⬜ Semrush/Ahrefs sync agent.
7. ⚠️ BullMQ queue + cron endpoint — queue, worker process, and cron route exist; the worker performs no sync. **Blocked on a hosting decision**: nothing runs `lib/queue/worker.ts` in production.
8. ⚠️ `current_metrics` + `is_stale` — table, reads, and `markMetricsStale()` exist; no caller sets the flag.
9. ⚠️ Metrics read route — `/api/metrics/{clientId}/overview` and `/keywords` exist; the planned `/api/metrics/{clientId}` and `/history` do not.
10. ✅ Dashboard UI — metric cards, trends, keyword table, date range.
11. ⚠️ Stale banner + last_updated — the UI renders from `is_stale`, so the banner can never fire while step 8 has no writer.
12. ⬜ Admin panel — no `components/features/admin`; clients and credentials are provisioned by SQL/seed scripts.
13. ⬜ AI insight generation (Claude API).
14. ✅ CSV/PDF export behind a sliding-window quota (`lib/exports/quota.ts`).

Sequencing rule that still holds: schema → auth/RLS → sync agent per source → queue/cron → cache → read routes → dashboard → admin → insights. Do not build a read route before the agent that fills it, and do not build UI against a column nothing writes.