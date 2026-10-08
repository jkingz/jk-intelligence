-- Admin provisioning: five security definer functions in public, no new table grants.
--
-- Why public: PostgREST exposes schemas = ["public", "graphql_public"]
-- (supabase/config.toml:13), so an RPC in private is unreachable from supabase.rpc().
-- private holds only the two helpers policies call. Shape follows public.persist_metrics
-- (20260917000000_seo_poc.sql:215, granted at :283-286), with execute aimed at
-- authenticated instead of service_role.
--
-- Reserved raise codes for this feature: 45001 (business rule refused),
-- 45002 (a write matched no row). 42501 is the role guard, 23505 / 23503 / 23514 are
-- Postgres' own and propagate untouched.
--
-- Advisory lock key 800100 guards the last-admin rule. It is the repository's first
-- pg_advisory_xact_lock; the key is registered here because a magic number with no
-- registry is how two features discover they share one lock.
--
-- admin_directory() is set-returning, so max_rows = 1000 (supabase/config.toml:18) caps
-- it. Measured on the local stack on 2026-10-05: with 1003 rows in auth.users the RPC
-- returned exactly 1000.
--
-- Grants, stated honestly: the revokes below take EXECUTE from public, anon and
-- authenticated, then grant it back to authenticated so the PostgREST role can call the
-- RPCs at all. service_role keeps EXECUTE anyway -- Supabase's default function ACL names
-- it, and revoking from PUBLIC does not reach a grantee-specific entry. That is not a
-- hole: the guard reads the caller's JWT via auth.uid(), and a service-role key carries
-- no user id, so the privilege check runs before any row is touched. Measured on the
-- local stack on 2026-10-05: admin_create_client() with the service-role key answers
-- 42501. What the key *can* still do is insert into public.clients directly, which it has
-- always been able to do; these functions add no new surface for it.

create or replace function public.admin_directory()
returns table (id uuid, email text, name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- plpgsql rather than sql, and named rather than anonymous: language sql cannot
  -- raise, and without this guard every signed-in user receives every account's
  -- email address. Verified on the local stack on 2026-10-05: with the guard absent
  -- a staff session and a client@b session each got all four directory rows.
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  -- u.email is varchar(255) in auth.users; the declared OUT column is text, and
  -- plpgsql will not coerce it. Without the cast an admin call fails with
  -- 42804 "structure of query does not match function result type" (local stack,
  -- 2026-10-05). The jsonb text extraction is already text.
  return query
    select u.id,
           u.email::text,
           u.raw_user_meta_data ->> 'name',
           u.created_at
      from auth.users u
     order by u.created_at;
end;
$$;

create or replace function public.admin_create_client(
  p_name text,
  p_domain text
)
returns public.clients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.clients;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  insert into public.clients (name, domain)
  values (trim(p_name), lower(trim(p_domain)))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_update_client(
  p_id uuid,
  p_name text default null,
  p_is_active boolean default null
)
returns public.clients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.clients;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  -- No domain parameter, on purpose: lower(domain) is both clients_domain_key
  -- (20260917000000_seo_poc.sql:18) and scripts/seed.mjs's upsert key, so an admin
  -- edit here makes the next seed run insert a duplicate client.
  update public.clients
     set name      = coalesce(nullif(trim(p_name), ''), name),
         is_active = coalesce(p_is_active, is_active)
   where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'no such client' using errcode = '45002';
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_attach_member(
  p_user_id uuid,
  p_role text,
  p_client_id uuid default null
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.users;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  -- Two concurrent writes to the last two admin rows would each see one surviving
  -- admin and both commit. The lock is transaction-scoped, so it releases on commit.
  perform pg_advisory_xact_lock(800100);

  -- users_admin_has_no_tenant (20260917000000_seo_poc.sql:26) forbids admin + client_id,
  -- so an admin row nulls its tenant rather than trusting the caller to have omitted it.
  insert into public.users (id, role, client_id)
  values (p_user_id, p_role, case when p_role = 'admin' then null else p_client_id end)
  on conflict (id) do update
     set role      = excluded.role,
         client_id = excluded.client_id
  returning * into v_row;

  -- Checked after the write, inside the same transaction: the raise aborts it, so a
  -- refused demotion leaves the row exactly as it was and no rollback bookkeeping is
  -- needed. Only a non-admin target can empty the admin set.
  if p_role <> 'admin' and not exists (select 1 from public.users where role = 'admin') then
    raise exception 'an admin must remain' using errcode = '45001';
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_detach_member(p_user_id uuid)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.users;
begin
  if private.current_user_role() is distinct from 'admin' then
    raise exception 'admin privilege required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(800100);

  delete from public.users where id = p_user_id returning * into v_row;

  if not found then
    raise exception 'no such member' using errcode = '45002';
  end if;

  if v_row.role = 'admin' and not exists (select 1 from public.users where role = 'admin') then
    raise exception 'an admin must remain' using errcode = '45001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_directory()                                   from public, anon, authenticated;
revoke all on function public.admin_create_client(text, text)                    from public, anon, authenticated;
revoke all on function public.admin_update_client(uuid, text, boolean)           from public, anon, authenticated;
revoke all on function public.admin_attach_member(uuid, text, uuid)              from public, anon, authenticated;
revoke all on function public.admin_detach_member(uuid)                          from public, anon, authenticated;

grant execute on function public.admin_directory()                       to authenticated;
grant execute on function public.admin_create_client(text, text)         to authenticated;
grant execute on function public.admin_update_client(uuid, text, boolean) to authenticated;
grant execute on function public.admin_attach_member(uuid, text, uuid)   to authenticated;
grant execute on function public.admin_detach_member(uuid)               to authenticated;
