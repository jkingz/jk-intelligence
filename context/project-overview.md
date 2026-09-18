# SEO Reporting Platform

## Overview

Multi-client automated SEO reporting platform. Clients and internal staff log in to view marketing and SEO performance data pulled daily from GSC, GA4, and SEO APIs. AI generates plain-English performance summaries. Admins manage clients, credentials, and sync jobs from a central admin panel.

## Goals

1. Authenticated multi-client access with strict data isolation.
2. Automated daily data syncing from GSC, GA4, Semrush/Ahrefs.
3. Historical metric storage and trend visualization.
4. AI-generated performance commentary per client.
5. Admin panel to add/manage clients and API credentials.
6. Resilient sync: API failure does not break dashboard.

## Core User Flow

1. User signs in (Google OAuth).
2. Client routed to own dashboard; admin routed to client list.
3. Dashboard loads from cache (current_metrics); stale banner shown if > 24hrs.
4. User views organic traffic, conversions, rankings, keyword movements.
5. User selects date range for historical comparison.
6. AI insight widget shows auto-generated summary of performance.
7. Admin adds new client → sets API credentials → activates daily sync.
8. Daily cron job syncs all clients → stores snapshots → updates cache.
9. User downloads CSV/PDF export of metrics.

## Features

### Authentication & Access Control

- Google OAuth and email/password via Supabase Auth, with email confirmation and password recovery.
- Route protection: clients see only own data (RLS at DB layer).
- Roles: admin (full access) | client (own data only) | staff (assigned clients).

### Multi-Client Dashboard

- Per-client dashboard: organic traffic, conversions, clicks, impressions, CTR, avg position.
- Keyword rankings: top 3/10/20, biggest movers (up/down).
- Landing page performance, backlinks summary, SEO visibility score.
- Month-on-month + custom date range comparisons.
- Last updated timestamp + stale-data warning banner.

### Automated Data Sync

- Daily cron job (2 AM) syncs all active clients.
- Parallel API calls per client (Promise.allSettled — partial failure safe).
- Sources: Google Search Console, GA4, Semrush/Ahrefs.
- Retry: exponential backoff (3 attempts per source).
- Circuit breaker: pause after 5 consecutive failures, alert admin.
- Sync logs persisted per client per run.

### AI Performance Insights

- Claude API generates plain-English summary per client.
- Input: current metrics + historical deltas.
- Output: top wins, top declines, recommended focus areas.
- Cached (not regenerated daily — cost control).

### Admin Panel

- Add/manage clients and API credentials (stored in Supabase Vault).
- View sync logs and failure alerts per client.
- Manual sync trigger per client.
- Activate/deactivate clients.

### Data Export

- CSV export of historical metrics.
- PDF report generation (per client, per date range).

## Scope

### In Scope

- Google OAuth + route protection
- Multi-client data isolation (Supabase RLS)
- Admin panel: client + credential management
- GSC, GA4, Semrush/Ahrefs API integrations
- Automated daily sync with error handling + retry
- Historical metric storage (immutable snapshots)
- Denormalized current_metrics cache (fast dashboard loads)
- Stale-data detection + warning UI
- Keyword rankings time-series
- AI-generated performance summaries (Claude API)
- CSV + PDF export
- Sync audit logs

### Out of Scope

- Billing and subscriptions
- White-label branding per client (Phase 3+)
- Competitor benchmarking (Phase 2+)
- Technical SEO health crawl (Phase 2+)
- Versioned spec history
- Mobile-native app (responsive web only)
- Slack/Zapier integrations

## Success Criteria

1. Client logs in, sees only their own data.
2. Daily sync runs without manual intervention.
3. Dashboard renders cached data even if all APIs are down.
4. Admin can add new client and activate sync in < 5 mins.
5. AI insight summary generated and displayed per client.
6. Historical trend visible across any custom date range.
7. CSV/PDF export works for any date range.
8. Sync failures logged, admin alerted, no dashboard crash.