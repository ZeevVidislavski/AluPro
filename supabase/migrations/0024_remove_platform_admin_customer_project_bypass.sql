-- =====================================================================
-- 0024_remove_platform_admin_customer_project_bypass.sql
-- Fixes cross-tenant mixing: 0018 added `or is_platform_admin()` to the
-- customers/projects SELECT policies, but the Customers/Projects screens
-- (customerService.list / projectService.list) don't filter by tenant —
-- they rely on RLS. So a platform admin saw every company's customers and
-- projects mixed together in the normal app.
--
-- The platform console never reads these tables directly (usage counts
-- come from platform_tenant_usage(), SECURITY DEFINER), so the bypass is
-- not needed. This restores the original tenant-scoped policies from
-- 0001/0003. tenants/tenant_memberships/profiles keep their bypass: the
-- console needs them and the app filters those by tenant_id itself.
-- =====================================================================

drop policy customers_select on public.customers;
create policy customers_select on public.customers
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

drop policy projects_select on public.projects;
create policy projects_select on public.projects
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );
