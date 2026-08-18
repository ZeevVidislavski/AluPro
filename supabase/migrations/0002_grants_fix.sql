-- =====================================================================
-- 0002_grants_fix.sql
--
-- Fixes a real gap discovered while testing the PoC in the browser:
-- RLS policies alone are NOT enough. Postgres checks table-level GRANTs
-- BEFORE it even evaluates RLS policies. 0001_poc_core.sql enabled RLS
-- and created policies, but never granted the `authenticated` role basic
-- SELECT/INSERT/UPDATE access to the tables in the first place — so every
-- request from the app (which connects as `authenticated`, not as the
-- table owner) failed with a hard "permission denied" error (Postgres
-- error 42501), before RLS ever got a chance to allow/deny anything.
--
-- This is not a mistake unique to this schema — it's a very common gap
-- when hand-writing RLS-based schemas (Supabase's own dashboard/CLI
-- scaffolding usually does this for you when you create a table through
-- the UI, but it doesn't happen automatically when you write raw SQL
-- migrations by hand, which is what ADR-07 chose for this project).
--
-- With RLS enabled, granting these privileges is safe: RLS policies
-- still narrow down exactly which ROWS a query can see/touch. This GRANT
-- only says "authenticated users may attempt SELECT/INSERT/UPDATE on
-- this table at all" — RLS still decides row-by-row.
-- =====================================================================

grant select on public.tenants to authenticated;
grant update on public.tenants to authenticated;

grant select on public.tenant_memberships to authenticated;
grant insert on public.tenant_memberships to authenticated;
grant update on public.tenant_memberships to authenticated;

grant select on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
grant update on public.profiles to authenticated;

grant select on public.customers to authenticated;
grant insert on public.customers to authenticated;
grant update on public.customers to authenticated;

-- RPC functions (soft_delete_customer / restore_customer) also need
-- explicit EXECUTE grants — SECURITY DEFINER doesn't imply "callable by
-- anyone", it only changes whose privileges the function body runs with
-- once it IS called.
grant execute on function public.soft_delete_customer(uuid) to authenticated;
grant execute on function public.restore_customer(uuid) to authenticated;

-- =====================================================================
-- End of 0002_grants_fix.sql
-- =====================================================================
