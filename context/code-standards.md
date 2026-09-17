# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component or route.
- Respect system boundaries defined in `architecture-context.md`.
- Every agent (sync, transform, cache, auth) lives in its own file.

## TypeScript

- Strict mode required throughout.
- No `any` — use explicit interfaces or narrowly scoped types.
- Validate all external API responses at boundary before storing (use Zod).
- Use `interface` for object contracts, `type` for unions/aliases.

```ts
// ✅
interface MetricSnapshot {
  clientId: string
  date: string
  platform: Platform
  metricType: MetricType
  value: number
  metadata?: Record<string, unknown>
}

// ❌
const data: any = await fetchGSC()
```

## Next.js

- Default to React Server Components.
- Add `"use client"` only for charts, date pickers, real-time stale banners.
- Route handlers handle one responsibility: auth → validate → delegate to lib.
- Never run sync jobs inline in route handlers — always queue via BullMQ.
- Long-running work belongs in BullMQ jobs, not request handlers.

## Styling

- Use CSS custom property tokens defined in `globals.css` — no raw Tailwind color classes like `zinc-*` or hardcoded hex values.
- Reference tokens through Tailwind utility names: `bg-base`, `text-copy-primary`, `border-surface-border`, `text-brand`.
- Border radius scale: `rounded-xl` small elements, `rounded-2xl` cards, `rounded-3xl` modals.
- Dashboard metric cards always use `rounded-2xl`.
- Stale-data banner uses warning token — never hardcoded yellow.

## API Routes

- Validate and parse request input (Zod) before any logic runs.
- Enforce auth + client ownership checks before any mutation.
- Return consistent response shapes: `{ data, error, meta }`.
- Keep handlers thin — push complexity into `lib/db`, `lib/agents`, `lib/queue`.
- Never return raw API credentials in any response.

```ts
// ✅ thin handler pattern
export async function GET(req: Request, { params }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const metrics = await getClientMetrics(params.clientId, user)
  return json({ data: metrics })
}
```

## Data & Storage

- All metric data in Supabase Postgres — no external blob storage.
- metrics_snapshots is append-only — never update or delete historical rows.
- current_metrics is the only mutable cache layer — updated after each sync.
- API credentials stored in Supabase Vault only — never in .env, logs, or API responses.
- Never expose service-role key to client components or `NEXT_PUBLIC_*` vars.
- RLS enabled on every table — policies must match role model (admin/client/staff).
- is_stale computed server-side and stored — client reads flag, never computes it.

## Agent Standards

- Each agent is a pure function where possible (input → output, no side effects).
- Sync agent uses Promise.allSettled — never let one API failure block others.
- Transform agent validates schema with Zod before writing to DB.
- Cache agent reads/writes Redis only — no direct DB calls.
- Circuit breaker state stored in Redis — not in memory (survives restarts).

```ts
// ✅ partial failure safe
const [gsc, ga4, semrush] = await Promise.allSettled([
  syncGSC(creds.gsc),
  syncGA4(creds.ga4),
  syncSemrush(creds.semrush),
])
// handle each result independently
```

## Error Handling

- Every agent wraps in try/catch — log to sync_logs, never throw to client.
- Sync failures → write failed status to sync_logs → mark is_stale → alert admin.
- Dashboard never shows 500 — always falls back to cached data + stale banner.
- API errors logged with: clientId, platform, timestamp, error message (no credentials).

## File Organization

```
lib/
  agents/       — syncAgent, transformAgent, cacheAgent, authAgent
  db/           — metrics, clients, credentials, syncLogs persistence
  queue/        — BullMQ job definitions, circuit breaker
  supabase/     — client construction, vault access
components/     — UI only, no business logic
app/
  api/          — thin route handlers (auth, metrics, sync trigger, cron)
  dashboard/    — server components, client charts
types/          — shared interfaces (MetricSnapshot, Client, SyncLog, etc.)
supabase/
  migrations/   — versioned schema, RLS policies, indexes
```

- Name files after responsibility, not technology.
- No business logic in `components/`.
- No DB calls in `app/api/` — delegate to `lib/db`.
- No sync logic in route handlers — delegate to `lib/queue`.