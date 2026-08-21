-- =====================================================================
-- 0020_tenant_subscriptions_self_select.sql
-- M6 (Feature A, part 1/1): let a regular tenant member read their own
-- tenant's plan.
--
-- tenant_subscriptions_select (0017_tenant_subscriptions.sql) was
-- written for M1's read-only platform-admin console and only ever
-- checked is_platform_admin() — there was no branch for a regular
-- tenant member reading their OWN subscription row. That was fine while
-- nothing in the tenant-facing app needed to know its own plan, but M6
-- gates a nav item ("🤖 ניהול חכם") on plan, which means the client app
-- now needs to read tenant_subscriptions as a normal (non-platform-admin)
-- user. Without this, every tenant user gets zero rows back and the app
-- silently treats every tenant as if it had no subscription.
--
-- Any role (owner/admin/member/viewer) can see their own tenant's plan —
-- unlike billing EDIT access (still platform-admin only, unchanged), this
-- is just "what plan am I on", needed by every member to know what
-- features are visible to them, not a privileged operation.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

drop policy tenant_subscriptions_select on public.tenant_subscriptions;

create policy tenant_subscriptions_select on public.tenant_subscriptions
  for select using (
    tenant_id in (select public.user_tenant_ids())
    or public.is_platform_admin()
  );

-- =====================================================================
-- End of 0020_tenant_subscriptions_self_select.sql
-- =====================================================================
