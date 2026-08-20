-- =====================================================================
-- 0018_platform_admin_rls_bypass.sql
-- Super-admin console, milestone M1 (part 3/3): cross-tenant read access
-- for platform admins, added to 5 pre-existing SELECT policies.
--
-- Kept as its OWN migration file, not folded into 0016/0017, because this
-- is the single highest-risk file in the whole super-admin feature: it
-- modifies RLS on 5 tables that already carry real tenant data
-- (tenants, tenant_memberships, profiles, customers, projects). Isolating
-- it makes it trivial to review or revert independently of the purely
-- additive 0016/0017.
--
-- Design, stated explicitly for review:
--
-- 1. Every change here is `OR public.is_platform_admin()` appended to an
--    EXISTING policy's USING clause — nothing else about the policy
--    changes. For any user with no row in platform_admins,
--    is_platform_admin() is false, so the added OR branch is simply never
--    true and the policy's behavior is byte-for-byte identical to before
--    this migration. Tenant isolation for ordinary users is unaffected.
--
-- 2. This is READ-ONLY. No INSERT/UPDATE/DELETE policy is touched — a
--    platform admin gets no new write access to tenant business data
--    through this migration. The two writes Zeev actually needs
--    (tenant_subscriptions, tenant status suspend/reactivate) go through
--    their own tables/RPCs (0017, and a future M2 migration for tenant
--    status), not through loosened CRUD policies here.
--
-- 3. The existing helper functions (user_tenant_ids/user_tenant_role/
--    is_tenant_admin) are NOT modified. Changing those would silently
--    alter behavior for every RLS policy across all of 0001-0015 that
--    calls them (partners, quotes, reminders, material orders, etc.) —
--    an enormous blast radius for something only 5 tables need. Explicit
--    per-policy OR is more verbose but scoped and auditable.
--
-- 4. Tables added in 0005-0015 (partners, payments, orders,
--    project_quotes, reminders, company_headers, model_catalog, etc.) are
--    deliberately NOT given a platform-admin bypass here. Zeev's phase-1
--    console (tenant list, billing, usage counts, membership list)
--    doesn't touch them. Extend later, table-by-table, only when a
--    concrete console screen actually needs it — not "just in case".
--
-- tenants_select and memberships_select intentionally do NOT require
-- deleted_at is null in the platform-admin branch: Zeev needs to see
-- suspended/soft-deleted tenants too (that's the whole point of a
-- billing/status console), unlike the ordinary tenant-user branch which
-- correctly hides deleted rows from regular members.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- ---------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------

drop policy tenants_select on public.tenants;

create policy tenants_select on public.tenants
  for select using (
    (deleted_at is null and id in (select public.user_tenant_ids()))
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------
-- tenant_memberships
-- ---------------------------------------------------------------------

drop policy memberships_select on public.tenant_memberships;

create policy memberships_select on public.tenant_memberships
  for select using (
    (
      deleted_at is null
      and (
        profile_id = auth.uid()
        or public.is_tenant_admin(tenant_id)
      )
    )
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or id in (
      select tm.profile_id from public.tenant_memberships tm
      where tm.tenant_id in (select public.user_tenant_ids())
        and tm.deleted_at is null
    )
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------

drop policy customers_select on public.customers;

create policy customers_select on public.customers
  for select using (
    (deleted_at is null and tenant_id in (select public.user_tenant_ids()))
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------

drop policy projects_select on public.projects;

create policy projects_select on public.projects
  for select using (
    (deleted_at is null and tenant_id in (select public.user_tenant_ids()))
    or public.is_platform_admin()
  );

-- =====================================================================
-- End of 0018_platform_admin_rls_bypass.sql
-- =====================================================================
