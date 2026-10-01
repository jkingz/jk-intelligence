# Paid-ads monitoring: reshaping a single-grain SEO reporter into an agency account console

Date: 2026-09-24 · Status: draft for review · Branch: `dev`

Evaluates the second candidate vertical (agency paid-media monitoring: many client accounts, one
operator, a daily sweep, protective action on spend). This is a **design**, not a task plan; the
paired implementation plan comes after §13 lands. Nothing here is committed or built.

Reads `docs/target-state.md:331` as the governing sequencing rule — schema → auth/RLS → one sync
agent → queue/cron → read routes → dashboard → admin → insights. This reshape is an extension of
that chain, not a fork around it.

## 0. Three calls made rather than asked

Each is a one-line reversal if you disagree.

1. **`metric_rows` becomes a new typed, entity-scoped fact table; `current_metrics` stays SEO-only
   and ads never writes to it.** The alternative — forcing ads through the existing JSONB rollup —
   is what makes this reshape look cheap and then makes alerting impossible. Spike detection is
   `campaign X spend vs. campaign X's 7-day average`, which is a `GROUP BY` in SQL or a slow,
   fragile scrape of a JSONB array in TypeScript. Cost of my choice: **two metric shapes coexist**
   until the SEO sync is built (steps 4–6 of target-state), and possibly permanently.
2. **Credentials move from per-client to per-scope, because an agency's Google Ads credential is
   one MCC that reaches 40 customers.** `api_credentials.client_id` is `not null` today
   (`20260917000000_seo_poc.sql:32`). Leaving it as-is means storing the same refresh token 40 times
   and rotating 40 rows on one revocation. This is the change most likely to be wrong — §4 states
   the assumption it rests on.
3. **The write path (pause/budget) is last, and its audit row is written *before* the ad-platform
   call.** A pause that fails mid-request still has to be reported as attempted, not absent.

## 1. What the reshape actually costs (measured, not assumed)

The earlier "it's just a CHECK-constraint edit" framing was wrong in one specific way. The column
is JSONB, but the **type** behind it is a fixed SEO record:

```ts
// types/metrics.ts:5 — every field is an SEO concept
export type NormalizedMetric = {
  clicks; impressions; ctr; position; conversions; keyword; rank; searchVolume;
};
```

There is no `spend`, no `cpc`, no campaign identity, and `lib/dashboard/overview.ts:30-35`
(`DayBucket`) reads only `clicks / impressions / conversions`. So adding a paid source touches:
`types/metrics.ts:1` (the `SOURCES` const), five DDL `CHECK` constraints, the read model, the CSV/PDF
column set, and `scripts/seed.mjs`. Not a rebuild — but it is a type-level change wearing a
constraint-edit costume.

Verified current state of the blockers:

| Blocker | Evidence |
| --- | --- |
| No live data at all | `lib/queue/worker.ts:10` returns `mock_completed`; rows come from `scripts/seed.mjs` |
| No worker host | `vercel.json` ships only `0 2 * * *` → `GET /api/cron/sync` |
| Credentials unresolvable | `architecture-context.md:67`; `credential_reference` matches `^vault:<uuid>$` (`:39`) and no code reads it |
| No alerting | `circuit breaker` / `alert admin` appear only in `context/*.md`; zero code |
| No mutation surface | no `for insert/update/delete` policy exists on any of the seven tables |
| Google identity off | commit `c6c8904` muted Google/Apple sign-in — provider unconfigured; Google Ads API auth rides the same Google project |

## 2. Non-goals, with the reason each is out

| Excluded | Why |
| --- | --- |
| Pixel / tag / conversion-tracking setup | Explicitly excluded by the role itself; the app should *detect* tracking breakage (a leads-with-no-calls shape) not install it |
| Bing, Pinterest, TikTok, LinkedIn | "Grow into" per the role. §5's adapter contract is what makes each one additive; building four now buys nothing |
| Cross-platform budget strategy | Owned by the strategist; this tool reports and executes, it does not allocate |
| Creative upload | The role's "build campaigns in" tier, phase 3+ |
| Multi-currency conversion | Ads amounts arrive as currency-scoped micros. §3 puts `currency` on the row; no FX normalization, because a CPL comparison across currencies is not a comparison |
| Replacing Monday.com / Slack as system of record | This app is the evidence store; the agency's tracker stays the tracker. Only an outbox to them |
| Deprecating the SEO vertical | SEO and ads coexist per client; `clients.is_active` already gates a tenant |
| Making the landing page honest *now* | See §12 slice 0 — it happens when the first real source lands, not before, so the copy is never more true than the build |

## 3. Schema: one new grain, one new fact table

### 3.1 `entities` — the generic dimension

Ads are campaign → ad group → creative. SEO is page and keyword. GBP is location. All four are the
same shape: a hierarchically-parented, named, source-scoped thing a metric attaches to. Modelling
it once is why this reshape does not need a third reshape when a location vertical arrives.

```sql
create table public.entities (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null,
  external_id text not null,           -- the platform's own id, verbatim, never parsed
  kind text not null check (kind in ('campaign','ad_group','creative','page','location')),
  name text not null,
  parent_id bigint references public.entities (id) on delete set null,
  status text,                          -- platform vocabulary: ENABLED / PAUSED / REMOVED
  daily_budget numeric,                 -- nullable: not every kind has one
  currency text,                        -- ISO 4217, from the account, never inferred
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint entities_client_source_external_unique
    unique (client_id, source, external_id),
  constraint entities_source_check check (source in ('gsc','ga4','semrush','google_ads','meta_ads'))
);
```

`external_id text`, not `uuid`: Google customer ids are digits, Meta ad ids are digits, and both
change shape without warning. Storing them verbatim and never parsing is the durable choice.

**Deleted-then-resurrected entities are a paid-ads fact, not an edge case** — campaigns get paused,
removed, and rebuilt with the same name. `last_seen_at` plus `status` handles it; nothing
hard-deletes, because `metric_rows` must keep pointing at a row.

### 3.2 `metric_rows` — queryable, entity × day

```sql
create table public.metric_rows (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null,
  entity_id bigint references public.entities (id) on delete restrict,  -- null == account-level rollup
  date date not null,
  impressions bigint, clicks bigint, conversions numeric,
  spend numeric, cpc numeric, cost_per_conversion numeric, ctr numeric,
  currency text,
  run_id text not null,
  attributes jsonb not null default '{}'::jsonb,   -- source-specific extras, never alerted on
  synced_at timestamptz not null,
  constraint metric_rows_source_check
    check (source in ('google_ads','meta_ads')),
  constraint metric_rows_client_source_entity_date_run
    unique (client_id, source, entity_id, date, run_id) nulls not distinct,
  constraint metric_rows_attributes_object
    check (jsonb_typeof(attributes) = 'object')
);
create index metric_rows_alert_idx on public.metric_rows
  (client_id, source, entity_id, date desc);
```

Deliberate properties:

- **Only five alertable numerics are columns** (`spend, clicks, impressions, conversions, ctr`)
  — enough to evaluate every check in the monitoring SOP, few enough that the set is stable across
  platforms. Everything exotic goes in `attributes`, and §7 forbids alerting on `attributes` so the
  contract cannot rot.
- **`unique (…run_id)` makes a re-run idempotent** the same way `metrics_snapshots:57` does —
  including `nulls not distinct`, because Postgres treats NULLs as distinct in a unique constraint by
  default and every account-level row has `entity_id is null`, so without it the rollup rows silently
  escape idempotency. That clause is PG 15+; §11 probe 2 confirms the project's version before
  trusting it. A same-day, same-entity re-run with *different* numbers then inserts a second row
  rather than overwriting — which is correct, because the API revises late conversions. Reads take
  `distinct on (client_id, source, entity_id, date) … order by synced_at desc`. §11 probes that
  this reads the way the alert SQL needs.
- **Append-only, like `metrics_snapshots`** (invariant 7, `architecture-context.md:114`). No UPDATE;
  a correction is a later row. Enforced the same way the base migration already does it — `revoke
  update, delete … from authenticated`, and the service-role writer is the only path.
- `entity_id on delete restrict` — losing an entity would silently orphan history.

### 3.3 `current_metrics` is now "the SEO fast-path cache", not the universal one

The ads dashboard's client-level cards read `sum()` over `metric_rows` for the window — ~90 days ×
N campaigns is trivially indexed by `metric_rows_alert_idx`, and it means one source of truth for
ad money numbers. So `current_metrics` (`:74`, PK `(client_id, source)`) is left **untouched**, and
the constraint list gains one documented non-goal: nothing paid writes it. This is also why
`buildOverview()` needs no change and no SEO test regresses — §12's slices depend on that.

### 3.4 Constraint sweep, and the two-places problem

Adding `google_ads` / `meta_ads` means a **new** timestamped migration (`RULES.md:86` — never edit
an applied one) dropping and re-adding five checks: `api_credentials_source_check` (`:36`),
`metrics_snapshots_source_check` (`:55`), `current_metrics_source_check` (`:73`, if the rollup
decision in §3.1 reverses), `keyword_rankings_source_check` (`:85`), `sync_logs_source_check`
(`:100`). Plus `sync_logs_stage_check` (`:98`) gains `'alert'` and `'action'` (§7, §8).

`SOURCES` in `types/metrics.ts:1` is the TypeScript truth; those five are the Postgres copy. They
**already can drift silently**, and this reshape adds a sixth place. Fix: one unit test that asserts
the TS array equals a parsed copy of the DDL constraint list, kept in `tests/platform/unit/` — the
`platform` folder is what `AGENTS.md` designates for cross-cutting primitives with no owning
feature. Cheaper than a generated enum, and it fails loudly instead of at runtime.

### 3.5 RLS

Every new table gets policies matching the existing role model (invariant 8). Direct precedent, and
the one that matters: `entities`, `metric_rows`, `alert_rules`, `alerts`, `action_log` all key on
`client_id`, exactly like `metrics_snapshots`, so they reuse the same
`private.current_user_client_id()` / `private.current_user_role()` helpers
(`20260917000000_seo_poc.sql:126-144`) rather than inventing a second mechanism.

Do **not** put `security invoker` selects on `metric_rows` for the dashboard. `getDashboardOverview`
(`lib/db/repository.ts:308`) reads through the service-role client because it runs inside
`unstable_cache`; the ads equivalents inherit that constraint, and the `client_id` they receive has
already cleared `canAccessClient` (`:294`). Invariant 4 is unmodified: no TS re-derivation of
ownership.

## 4. Credentials: the assumption that breaks

`api_credentials` today is `(client_id, source)` unique — one credential per tenant per platform,
which is right when the tenant owns its own GSC property. For an agency it is wrong in a specific,
load-bearing way:

> Assumption (§0.2 rests on it): **one agency-level OAuth credential reaches many client accounts
> via an MCC manager account**, so the credential is scoped to the agency, not the tenant.

If that is false for the actual customer mix (some clients will own their accounts and grant the
agency a user role instead), the same table must hold both shapes. The design that survives both:

```sql
alter table public.api_credentials alter column client_id drop not null;  -- guarded: see below
create table public.credential_scopes (…)  -- OR: client_id uuid null + external_account_id text
```

Prefer the narrower option: **keep one row per `(client_id, source)` but add
`external_account_id text not null`** (the Google customer id / Meta ad account id) and let the
vault reference it points at be a *shared* one. Then:

- Agency-MCC clients: 40 rows, `credential_reference` all pointing at the **same** vault uuid, each
  carrying its own `external_account_id`.
- Client-owned accounts: a row with its own vault reference.
- `unique (client_id, source)` holds unchanged; `drop not null` never happens; and rotation is one
  vault edit, not 40.

`current_user_role()`-only admins may touch this table (its select policy is already
`using (false)`, `AGENTS.md` "Tenant isolation"), and nothing in this reshape changes that — the
worker resolves vault references server-side with the service-role client, and no route ever
returns a `credential_reference`. Invariant 10 (`architecture-context.md:117`) stands.

**Verify before writing code:** whether Supabase Vault is actually enabled on the target project.
`credential_reference`'s `^vault:<uuid>$` regex implies intent, not provisioning. §11 probe 3.

## 5. Adapter contract, and the queue change

One interface, one implementation per platform, and *nothing else* in the app learns a platform's
name:

```ts
// lib/ads/sources/types.ts
// EntityRecord mirrors §3.1's insert columns (external_id, kind, name, parent_external_id,
// status, daily_budget, currency); MetricRowRecord mirrors §3.2's (entity external_id + date +
// the five alertable numerics + attributes). `parent_external_id` rather than `parent_id`
// because the adapter has never seen our bigint keys.
export interface AdsSourceAdapter {
  readonly source: "google_ads" | "meta_ads";
  fetch(input: {
    clientId: string; externalAccountId: string; credentialRef: string;
    from: string; to: string;              // ISO dates, UTC
  }): Promise<{
    entities: EntityRecord[];              // upsert into `entities`
    rows: MetricRowRecord[];              // append into `metric_rows`
  }>;
}
```

Adapters return **rows, not verdicts**: no thresholds, no status logic, no Postgres. That boundary
is what makes Bing/Pinterest/TikTok additive rather than structural, and it is testable with a
recorded fixture instead of a live token (§12 slice 1 depends on this).

`syncJobSchema` (`lib/queue/syncQueue.ts:5-8`) is `{ clientId, runId }` — source-free, because the
SEO worker would fan out to three sources with one set of credentials. Ads credentials, quotas, and
failure modes are per-source, so the job body gains a discriminator:

```ts
export const syncJobSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("seo"), clientId: z.uuid(), runId: z.string().min(1).max(100) }),
  z.object({ kind: z.literal("source"), clientId: z.uuid(), source: sourceSchema,
             runId: z.string().min(1).max(100) }),
]);
```

`discriminatedUnion` with an explicit `seo` arm, so every existing queued job in Redis is rejected
loudly rather than silently reinterpreted — `enqueueSync` parses at `:70`, and the worker parses at
`worker.ts:8`. Both sides change in the same commit; the migration note in §12 says which queue to
drain first.

Invariant 1 (`architecture-context.md:108`) is unchanged and now genuinely load-bearing: **no route
handler ever calls an ad API inline.** Every fetch is a job.

## 6. Scheduling: `0 2 * * *` cannot do this job

The SOP's first check is *intraday* spend vs. trailing average, and the whole point of the role's
"immediate protective action" clause is that the discovery happens before the day's budget is gone.
A once-daily sweep discovers yesterday's spike. So:

| Sweep | Cadence | Pulls | Writes |
| --- | --- | --- | --- |
| Full | daily, 02:00 | complete prior days, all entities | `entities` upsert + `metric_rows` append |
| Pacing | hourly | today only, partial | `metric_rows` append (revision-tolerant, §3.2) |

Vercel cron minimum frequency is plan-dependent, and the queue is already Redis-backed, so **the
pacing sweep should be an in-worker repeatable job, not a second Vercel cron**: BullMQ
repeatable jobs exist for exactly this, and it keeps one scheduler. Unverified and flagged for §11
probe 4: (a) whether the current Vercel plan permits an hourly cron at all; (b) whether hourly
partial-day pulls are supported per platform (`segments.hour` / per-day-with-today). Do not assume
(b) — one platform may only expose today's numbers after a processing delay, which changes the
alert semantics from "spike" to "spike detected at least 2 hours late". Say which, once measured.

Concurrency: `worker.ts:11` sets `concurrency: 3`. With 40 accounts and per-developer-token quota,
concurrency is a *quota* setting, not a performance one. It moves to env with a documented default
and the worker clamps it.

## 7. Alerting, as data and as SQL

```sql
create table public.alert_rules (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients (id) on delete cascade,  -- null == agency default
  source text not null,
  metric text not null check (metric in ('spend','cost_per_conversion','conversions','clicks','ctr')),
  window_days integer not null default 7 check (window_days between 1 and 90),
  pct_delta numeric check (pct_delta is null or pct_delta between -100 and 10000),
  absolute_max numeric,
  severity text not null default 'warn' check (severity in ('info','warn','critical')),
  enabled boolean not null default true,
  created_by uuid, created_at timestamptz not null default now(),
  constraint alert_rules_scope_unique unique (client_id, source, metric)
);

create table public.alerts (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  rule_id bigint references public.alert_rules (id) on delete set null,
  entity_id bigint references public.entities (id) on delete set null,
  state text not null check (state in ('firing','resolved','acknowledged','dismissed')),
  observed numeric, baseline numeric, threshold numeric,
  first_fired_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null,
  ack_by uuid, ack_at timestamptz,
  note text check (note is null or char_length(note) <= 2000)
);
```

Design decisions worth arguing with:

- **Thresholds live in Postgres, never in code.** `context/development-workflow.md:31` already makes
  "a guessed constant is an invented requirement" a repo rule, and the role explicitly says the
  strategist owns the bands. So the defaults in the SOP I drafted are *seed rows*, editable, with
  `client_id is null` = the agency-wide band.
- **Evaluation is one SQL statement per rule**, comparing today's row to
  `avg(spend) over (partition by entity_id order by date rows between 7 preceding and 1 preceding)`.
  Window functions in the fact table are precisely what §0.1 bought.
- **`rule_id on delete set null`** — a deleted rule must not erase the record that something fired.
- **`state` is not `ack_by is not null`**: dismissing and acknowledging are different outcomes, and
  the difference is what an audit of a spend incident reads as.
- Delivery: a `notifications` outbox row per firing alert, and one adapter that POSTs to a
  Slack-compatible incoming webhook. The URL is stored as a `vault:` reference (§4's mechanism),
  never as a column. **This reverses `context/project-overview.md:108`, which lists Slack as out of
  scope** — so §12 slice 4 updates that line rather than quietly contradicting it.

`sync_logs.stage` gains `'alert'` (§3.4), so a sweep that evaluated 5 rules and fired 2 is one log
row and two alert rows, not prose in a message field.

## 8. Operator action log — and why writes are last

The role's documentation requirement ("what happened, which account, what I observed, what action I
took") is a first-class record, not a log string:

```sql
create table public.action_log (
  id bigint generated always as identity primary key,
  client_id uuid not null, source text not null, entity_id bigint,
  actor uuid not null,                       -- the users row, not a JWT claim
  action text not null check (action in ('pause','enable','budget_set','bid_set','note')),
  requested jsonb not null,                  -- {dailyBudget: 250}
  before_state jsonb, after_state jsonb,     -- read back from the platform
  outcome text not null check (outcome in ('attempted','succeeded','failed','refused_band')),
  error text, created_at timestamptz not null default now(),
  constraint action_log_requested_object check (jsonb_typeof(requested) = 'object')
);
```

Ordering is the whole design (§0.3): insert `attempted` → call the API → update to `succeeded` /
`failed` with `after_state`. A crash between leaves a row saying *an operator tried this*, which is
the correct and uncomfortable truth.

**Bands are enforced in Postgres, not TypeScript** — a `security definer` function holds "budget
change ≤ N% per 24h for this client" and raises `45001` outside it, mirroring the last-admin rule in
the admin-provisioning spec (`docs/superpowers/specs/2026-09-24-admin-provisioning-design.md:90`).
This follows invariant 4's philosophy (ownership and privilege decided by the database) and refuses
the classic failure where the UI hides a button but the route still accepts the call.

Two hard dependencies, stated rather than discovered later:
- **The admin-provisioning spec is still an uncommitted draft.** Writes need a real actor, a member
  model, and a definer-function write pattern; all three are that spec's deliverable. This reshape
  does not start §8 before it lands.
- **A write-capable credential scope is a different approval than a read one** (§10). Read-only
  first is not timidity, it is the shorter path to something true.

Also refused: the `pause` button reaching Google directly from the browser. Route → definer function
→ queue → worker, so invariant 1 keeps holding and rate limits live in one process.

## 9. UI surface

A second dashboard, not a retrofit of `/dashboard`. The existing one answers "how is organic doing
over this range"; the monitoring board answers "what needs me today".

| Path | Purpose |
| --- | --- |
| `/monitor` | today's board: firing alerts by severity, per-account spend vs. yesterday, zero-lead accounts, pacing bars |
| `/monitor/[clientId]` | entity table for one account, sortable by delta, drill to 30-day per-campaign trend |
| `/monitor/alerts/[id]` | one alert: observed vs. baseline, the rule that fired, acknowledge / dismiss + note |

Reused, not rewritten: `components/features/dashboard/components/metric-card`, the stale banner (a
stale sweep on an ads account *is* a monitoring failure and must render identically),
`lib/exports` CSV (column set parameterized — the only real change there), and
`components/ui/in-view.tsx` for the trend charts.

New invariants for this page, both cheap and both easy to violate:
- **A timer, not a refresh loop.** A monitoring board that doesn't say "as of 09:14" is a
  liability, since the operator's whole job is noticing change.
- **No alert renders without its rule and window.** "Spend +61%" is not actionable; "spend +61% vs.
  7-day mean of 3 accounts, rule `default-spend-spike`" is.

`/dashboard` stays a prerendered static shell (invariant 12) and `/monitor` inherits the same rule —
all data arrives client-side, one boot request, skeleton while in flight. Three signed-in
destinations becomes five, which reopens the left-rail question that was previously deferred on
destination-count grounds; §14 carries it as an open item rather than this spec silently expanding
scope to answer it.

## 10. The critical path is approval, not code

Ordered by calendar risk, because this is where the estimate actually lives:

| Gate | What it costs | Blocking |
| --- | --- | --- |
| Google Ads API access | Google Cloud project + OAuth consent + **developer token**; a Basic/TEST token is limited to test accounts and cannot serve a real client. Upgrading needs an application with use case + review | any live Google fetch (§12 slice 2) |
| Meta Marketing API permissions | app review for `ads_read` / `ads_management`, and Business Verification for the app's business | any live Meta fetch |
| Client account access grants | the agency must get manager access per client, or the demo has no data | anything shown to the agency |
| Worker hosting | a persistent process + env parity with Vercel | any cron at all |

So: **file the two platform applications before writing a line**, and build slice 1 against a
recorded fixture so the schema and the read path don't idle behind a review queue.

Unverified and deliberately not asserted: current token-tier names, quota figures, review
durations, and whether either provider still requires a paid-application form. These change often
enough that a spec citing numbers would be wrong by the time it is read. Treat them as the first
thing to confirm on each platform's own docs, and record the answer in
`context/progress-tracker.md` with the date.

## 11. What must be proven before §3 is built

Four probes, all read-only, all against the **development** stack (`scripts/run-migrations.mjs` +
`SUPABASE_DB_URL` already in `.env`). Each can invalidate a section, which is why they precede it.

1. **`supabase/migrations/20260920000001_rls_hardening.sql`'s stance survives new tables.** It
   strips grants from tables arriving RLS-disabled. Create a throwaway `entities`-shaped table and
   confirm the hardened grant set is what §3.5 assumes, then drop it. If the hardening runs only at
   migration time in file order, §3.5's "reuse the same pattern" claim needs the ordering pinned.
2. **Revision semantics, and the PG version.** `show server_version` first — if it is below 15,
   `nulls not distinct` (§3.2) does not exist and the account-level rows need a sentinel
   `entity_id = 0` row or a partial unique index instead. Then insert two `metric_rows` for one
   `(client_id, source, entity_id, date)` with different `spend` and distinct `run_id`; confirm the
   `distinct on` read returns the later `synced_at` and that the alert window function sees one row
   per day, not two. If it double-counts, §3.2's uniqueness is wrong and the fix is a `latest` view —
   decide it now, not in slice 3.
3. **Vault exists.** `select count(*) from extensions.vault_decrypted_secrets` (or the project's
   equivalent) as the migration role. Zero or a permission error means §4 stores references to
   nothing, and the fallback is env-per-developer-token + one row per client.
4. **Cron and partial-day reality.** Confirm the Vercel plan's minimum cron cadence and, per
   platform, whether today's metrics are queryable before day close. §6's hourly pacing sweep is
   designed but unmeasured.

Additionally, cheap and local: `pnpm build`'s route table must show `/monitor` as `ƒ` and
`/dashboard` still `○`. The gate is the build output, not an assumption about cookies.

## 12. Delivery slices, each one independently true

Every slice ends with something that is not a lie when described. Ordered so the first one is
demoable to the agency and the last one is the only one that can spend money.

| # | Slice | Becomes true | Gate |
| --- | --- | --- | --- |
| 0 | Source registry + `entities` + `metric_rows` + RLS, zero adapters | the grain exists and is tested | §11 probes; `pnpm test && typecheck && lint && build` |
| 1 | Google Ads adapter behind a **recorded fixture**; `syncJobSchema` union; worker calls `persistAdsMetrics` | one account's data flows end-to-end offline | fixture test + unit tests, no network |
| 2 | Live fetch for **one real account**, read-only | the first honest screenshot | §10 gate A cleared |
| 3 | `/monitor` board + alert rules/evaluation + hourly pacing | the daily sweep stops being manual | `pnpm test && build` + one real firing alert reproduced |
| 4 | Slack-compatible outbox + `notifications`; `project-overview.md:108` corrected | the operator finds out without opening the app | delivery retried, never dropped |
| 5 | `action_log` + read-only manual pause via definer function + band enforcement | changes are auditable | §8's dependency on admin-provisioning landing |
| 6 | Meta adapter; `clients.is_active` per source | two platforms, one contract | same fixture harness as slice 1 |
| 7 | Landing copy for the ads vertical | the demo says what the build does | only after slice 2 or 3 |

Slice 0 has no product value alone; it is the one that makes 1–7 cheap. If that trade is refused,
the honest alternative is *stop at the spec* and build the SEO sync (target-state steps 4–6)
instead, because it shares slices 0, 3, 5 and 7 of this plan.

## 13. Docs duty and the verification gate

- `AGENTS.md`: new routes into the HTTP table; the test-folder table gains `ads-monitoring` and
  `platform` gains the enum-drift test; the "Implemented surface" section absorbs
  `entities`/`metric_rows`/`alerts` **only when a slice has run**, and `docs/target-state.md`
  sheds exactly the lines that slice made real.
- `context/architecture-context.md`: Storage Model (§3.3's narrowing of `current_metrics`),
  invariant 1 (queue is now source-scoped), and the schema list at `:35`.
- `context/project-overview.md`: the vertical becomes a stated product boundary, and `:108`'s Slack
  exclusion is edited rather than contradicted.
- `context/feature-specs/08-ads-monitoring.md` — required before implementation by
  `docs/conventions/feature-components.md`; `07` is taken by the admin spec.
- `context/progress-tracker.md`: per-slice entries, plus the §10 approval dates.
- **`RULES.md:75` is a defect** — it says "The integration tier currently holds **no files**", but
  `tests/tenant-isolation/integration/rls-gate.test.ts` exists (verified by `find tests`). Per
  `RULES.md:59` code is truth and the doc is the bug. Fix it in the docs change above, not as a
  drive-by.

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm test:all      # until a .env.test exists this is --passWithNoTests green: quote the
                   # "0 passed, N skipped" line in the tracker, because silence is
                   # indistinguishable from coverage here
pnpm test:e2e      # public tier; /monitor is behind auth so it contributes a guard case only
```

Tests live in `tests/ads-monitoring/{unit,integration,e2e}/`. The unit tier mocks at the adapter
boundary and never inside `lib/db` or the alert SQL — the alert rules are the product, so they get
the integration tier against real Postgres (`tests/helpers/db.ts`, inserts via service-role,
assertions via the user-scoped client). `tests/ads-monitoring/unit/adapter-fixture.test.ts` is the
only test in the repo allowed a JSON file of recorded platform responses; it makes no network call.

## 14. Open questions this spec does not settle

1. **Is this the product, or a job-application prop?** They want different things. A prop wants
   slices 0–3 and a screen recording. A product wants slices 0–7 plus billing, onboarding, and the
   credential self-service the admin spec doesn't cover. Nothing above resolves that, and slice 2's
   cost is near-zero for the prop and substantial for the product.
2. Does one operator watch all accounts, or is the book split — i.e. does `users.client_id` stay a
   single assignment, or does the reshape finally need the `client_assignments` join table that
   staff-only-for-one-client implies is missing?
3. Read-only first means the pause button is `action_log` + a human doing it in the platform. Is
   that acceptable operationally for the target agency, or does it break their "immediate protective
   action" promise badly enough to justify the extra approval risk of `ads_management` scope?
4. Conversion definitions: agencies of this shape count form-fill, call, and booked-job as three
   different "conversions". `metric_rows.conversions` is one number. Does the reshape need
   `conversions_by_category jsonb` (and then §7 forbids alerting on it) or a `lead_kind` dimension
   row — which is a real schema decision, and a bigger one than it looks?
5. Where does `is_stale` land for ads? A missed *hourly* pacing sweep is materially different from
   a missed daily, and invariant 9 keeps the computation server-side but doesn't say what the
   threshold is.
6. Does `/monitor` belong in the same product as `/dashboard` at all, or is the honest shape two
   surfaces with different information architecture — one a client-facing report, the other an
   operator console the client should never see? Slices 3–8 assume they coexist behind the same
   login; if an agency wants to hand clients the reporting view while keeping the monitoring board
   internal, that is a per-source visibility rule on `clients` + `entities`, and it is much cheaper
   to decide before `/monitor` exists than after.
