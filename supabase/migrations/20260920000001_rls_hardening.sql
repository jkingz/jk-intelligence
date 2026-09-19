-- Security hardening: any public table that reached the database with RLS
-- disabled (e.g. the migration runner's ad-hoc `public.schema_migrations`,
-- which Supabase's default table privileges granted to anon/authenticated) is
-- internal tooling. Enable RLS and strip anon/authenticated table grants so
-- the Supabase security advisor stops flagging the public schema.
do $$
declare
  t record;
begin
  for t in
    select format('%I.%I', n.nspname, c.relname)::regclass as tbl
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
  loop
    execute format('alter table %s enable row level security', t.tbl);
    execute format('revoke all on table %s from anon, authenticated', t.tbl);
  end loop;
end;
$$;