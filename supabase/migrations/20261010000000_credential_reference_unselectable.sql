-- The Connections page reports which sources a tenant linked, so it needs
-- client_id, source and created_at. It never needs credential_reference, and
-- until now nothing stopped a tenant from asking for it: RLS policies are
-- row-level, so a tenant who can see the row could select any column of it.
-- The reference is an opaque Vault pointer with no key material in it, so this
-- is defence in depth rather than a leak closing -- but it is the shape a real
-- credential write would inherit, and the sync worker is next.
--
-- 20260925000000_connections_read.sql:21 stays as it was: applied migrations
-- are never rewritten (RULES.md §16). This file supersedes it.
--
-- Consequence worth knowing: authenticated can no longer `select *` from this
-- table. Nothing does -- listConnections names the three columns and
-- tests/tenant-isolation/unit/connections-read.test.ts pins that.
revoke select on public.api_credentials from authenticated;

grant select (client_id, source, created_at) on public.api_credentials to authenticated;
