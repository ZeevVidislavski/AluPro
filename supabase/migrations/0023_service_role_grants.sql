-- =====================================================================
-- 0023_service_role_grants.sql
-- The Edge Functions platform-create-tenant-with-user and
-- tenant-invite-member write to profiles/tenants/tenant_memberships/
-- tenant_subscriptions as service_role. This project never received
-- default table privileges (0002 had to GRANT `authenticated` by hand for
-- the same reason), so those inserts fail with "permission denied" right
-- AFTER the auth user is created — leaving an auth user with no
-- membership. service_role bypasses RLS but still needs table GRANTs.
-- =====================================================================

grant select, insert, update, delete on public.profiles             to service_role;
grant select, insert, update, delete on public.tenants              to service_role;
grant select, insert, update, delete on public.tenant_memberships   to service_role;
grant select, insert, update, delete on public.tenant_subscriptions to service_role;
