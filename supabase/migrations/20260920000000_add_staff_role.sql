-- Add the 'staff' role so the schema matches the documented role model
-- (admin | client | staff). staff resolves a client assignment the same way
-- 'client' does (client_id FK); only admin must have no tenant.
alter table public.users
  drop constraint users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'client', 'staff'));