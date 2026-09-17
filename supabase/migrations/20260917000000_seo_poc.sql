create extension if not exists pgcrypto;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated, service_role;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index clients_domain_key on public.clients (lower(domain));

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client'
    check (role in ('admin', 'client')),
  client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint users_admin_has_no_tenant
    check (role <> 'admin' or client_id is null)
);

create table public.api_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null,
  credential_reference text not null,
  created_at timestamptz not null default now(),
  constraint api_credentials_source_check check (source in ('gsc', 'ga4', 'semrush')),
  constraint api_credentials_client_source_unique unique (client_id, source),
  constraint api_credentials_reference_shape
    check (credential_reference ~ '^vault:[0-9a-fA-F-]{36}$')
);

create table public.metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null,
  run_id text not null,
  metrics jsonb not null check (
    case when jsonb_typeof(metrics) = 'array'
      then jsonb_array_length(metrics) > 0
      else false
    end
  ),
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint metrics_snapshots_source_check check (source in ('gsc', 'ga4', 'semrush')),
  constraint metrics_snapshots_run_id_len check (char_length(run_id) between 1 and 512),
  constraint metrics_snapshots_client_run_unique unique (client_id, source, run_id)
);

create table public.current_metrics (
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null,
  snapshot_id uuid not null references public.metrics_snapshots (id) on delete cascade,
  run_id text not null,
  metrics jsonb not null check (
    case when jsonb_typeof(metrics) = 'array'
      then jsonb_array_length(metrics) > 0
      else false
    end
  ),
  synced_at timestamptz not null,
  is_stale boolean not null default false,
  constraint current_metrics_source_check check (source in ('gsc', 'ga4', 'semrush')),
  constraint current_metrics_pkey primary key (client_id, source)
);

create table public.keyword_rankings (
  snapshot_id uuid not null references public.metrics_snapshots (id) on delete cascade,
  metric_index integer not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null,
  keyword text not null,
  rank numeric not null check (rank >= 0),
  synced_at timestamptz not null,
  constraint keyword_rankings_source_check check (source in ('gsc', 'ga4', 'semrush')),
  constraint keyword_rankings_pkey primary key (snapshot_id, metric_index)
);

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  source text,
  stage text not null,
  status text not null,
  message text not null,
  job_id text,
  created_at timestamptz not null default now(),
  constraint sync_logs_stage_check check (stage in ('queue', 'sync', 'transform', 'cache')),
  constraint sync_logs_status_check check (status in ('queued', 'success', 'partial', 'failed', 'skipped')),
  constraint sync_logs_source_check check (source in ('gsc', 'ga4', 'semrush')),
  constraint sync_logs_message_len check (char_length(message) between 1 and 2000),
  constraint sync_logs_job_id_len check (job_id is null or char_length(job_id) between 1 and 512)
);

create index metrics_snapshots_client_source_synced_idx
  on public.metrics_snapshots (client_id, source, synced_at desc);

create index current_metrics_snapshot_idx on public.current_metrics (snapshot_id);

create index keyword_rankings_client_source_idx
  on public.keyword_rankings (client_id, source, synced_at desc);

create index keyword_rankings_keyword_idx on public.keyword_rankings (keyword);

create index sync_logs_client_created_idx on public.sync_logs (client_id, created_at desc);
create index sync_logs_job_idx on public.sync_logs (job_id);

alter table public.clients enable row level security;
alter table public.users enable row level security;
alter table public.api_credentials enable row level security;
alter table public.metrics_snapshots enable row level security;
alter table public.current_metrics enable row level security;
alter table public.keyword_rankings enable row level security;
alter table public.sync_logs enable row level security;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function private.current_user_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id from public.users where id = auth.uid()
$$;

revoke all on function private.current_user_role()
  from public, anon;
revoke all on function private.current_user_client_id()
  from public, anon;
grant execute on function private.current_user_role()
  to authenticated, service_role;
grant execute on function private.current_user_client_id()
  to authenticated, service_role;

create policy clients_select_authenticated on public.clients
  for select to authenticated
  using (
    private.current_user_role() = 'admin'
    or private.current_user_client_id() = clients.id
  );

create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or private.current_user_role() = 'admin'
  );

create policy api_credentials_no_direct_access on public.api_credentials
  for select to authenticated
  using (false);

create policy snapshots_select_tenant_or_admin on public.metrics_snapshots
  for select to authenticated
  using (
    private.current_user_role() = 'admin'
    or private.current_user_client_id() = metrics_snapshots.client_id
  );

create policy current_select_tenant_or_admin on public.current_metrics
  for select to authenticated
  using (
    private.current_user_role() = 'admin'
    or private.current_user_client_id() = current_metrics.client_id
  );

create policy rankings_select_tenant_or_admin on public.keyword_rankings
  for select
  to authenticated
  using (
    private.current_user_role() = 'admin'
    or private.current_user_client_id() = keyword_rankings.client_id
  );

create policy sync_logs_select_admin on public.sync_logs
  for select to authenticated
  using (private.current_user_role() = 'admin');

revoke all on public.clients from public, anon, authenticated;
revoke all on public.users from public, anon, authenticated;
revoke all on public.api_credentials from public, anon, authenticated;
revoke all on public.metrics_snapshots from public, anon, authenticated;
revoke all on public.current_metrics from public, anon, authenticated;
revoke all on public.keyword_rankings from public, anon, authenticated;
revoke all on public.sync_logs from public, anon, authenticated;

grant select on public.clients, public.users, public.metrics_snapshots,
  public.current_metrics, public.keyword_rankings, public.sync_logs
  to authenticated;
grant select on public.api_credentials to service_role;
grant all on public.clients, public.users, public.api_credentials,
  public.metrics_snapshots, public.current_metrics, public.keyword_rankings,
  public.sync_logs to service_role;

create or replace function public.persist_metrics(
  p_client_id uuid,
  p_source text,
  p_metrics jsonb,
  p_synced_at timestamptz,
  p_run_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot_id uuid;
begin
  if p_client_id is null or p_synced_at is null then
    raise exception 'client_id and synced_at are required';
  end if;

  if p_source is null or p_source not in ('gsc', 'ga4', 'semrush') then
    raise exception 'invalid source';
  end if;

  if p_metrics is null or jsonb_typeof(p_metrics) <> 'array' then
    raise exception 'metrics must be a JSON array';
  end if;

  if jsonb_array_length(p_metrics) = 0 then
    raise exception 'metrics must be nonempty';
  end if;

  if p_run_id is null or char_length(p_run_id) not between 1 and 512 then
    raise exception 'run_id length must be 1..512';
  end if;

  insert into public.metrics_snapshots (client_id, source, run_id, metrics, synced_at)
  values (p_client_id, p_source, p_run_id, p_metrics, p_synced_at)
  on conflict (client_id, source, run_id) do nothing
  returning id into v_snapshot_id;

  if v_snapshot_id is null then
    return;
  end if;

  insert into public.keyword_rankings (snapshot_id, metric_index, client_id, source, keyword, rank, synced_at)
    select v_snapshot_id,
         idx,
         p_client_id,
         p_source,
         m.value->>'keyword',
         (m.value->>'rank')::numeric,
         p_synced_at
    from jsonb_array_elements(p_metrics) with ordinality as m(value, idx)
   where m.value->>'keyword' is not null
     and m.value->>'rank' is not null;

  insert into public.current_metrics (client_id, source, snapshot_id, run_id, metrics, synced_at, is_stale)
  values (p_client_id, p_source, v_snapshot_id, p_run_id, p_metrics, p_synced_at, false)
  on conflict (client_id, source) do update
    set snapshot_id = excluded.snapshot_id,
        run_id = excluded.run_id,
        metrics = excluded.metrics,
        synced_at = excluded.synced_at,
        is_stale = false
   where current_metrics.synced_at <= excluded.synced_at;
end;
$$;

revoke all on function public.persist_metrics(uuid, text, jsonb, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.persist_metrics(uuid, text, jsonb, timestamptz, text)
  to service_role;
