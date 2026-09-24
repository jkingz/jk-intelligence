-- The Connections page reports which sources a tenant has linked. That is a
-- read over api_credentials, which until now had no readable rows for any
-- non-service role (using (false)). This is not a widening of the tenant rule:
-- the predicate is the one clients_select_authenticated already applies, so
-- Postgres keeps deciding visibility and no TypeScript helper grows the rule.
--
-- Deliberate: the policy is row-level, so `credential_reference` is selectable
-- by a tenant that can see the row. That is acceptable because the column holds
-- an opaque Vault *reference*, not a secret, nothing in this app decrypts it,
-- and no response, log line or cache entry in this change carries it. Recorded
-- as an accepted limitation in context/feature-specs/09-connections.md.
drop policy api_credentials_no_direct_access on public.api_credentials;

create policy api_credentials_select_tenant_or_admin on public.api_credentials
  for select to authenticated
  using (
    private.current_user_role() = 'admin'
    or private.current_user_client_id() = api_credentials.client_id
  );

grant select on public.api_credentials to authenticated;
