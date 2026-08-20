-- =====================================================================
-- 0016_platform_admin_core.sql
-- Super-admin console, milestone M1 (part 1/3): platform-admin identity.
--
-- Zeev (the platform owner) needs to see across ALL tenants, not just his
-- own. Nothing in 0001-0015 supports that — every helper function
-- (user_tenant_ids/user_tenant_role/is_tenant_admin) is hardcoded to the
-- caller's own tenant_memberships rows.
--
-- Deliberately a SEPARATE table, not a boolean column on profiles: adding
-- e.g. `is_platform_admin boolean` to profiles would mean every existing
-- profiles RLS policy (tenant-co-membership scoped) has to reason about
-- whether that column leaks to tenant users. A separate table gets its own
-- tiny GRANT story instead — see below, `authenticated` gets NO privilege
-- on this table at all, so even a client-side bug can't read who the
-- platform admins are. The only access path is is_platform_admin() below.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

create table public.platform_admins (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),

  unique (profile_id)
);

comment on table public.platform_admins is 'Platform-owner identification (Zeev). Presence of a row = platform admin. Deliberately separate from profiles (see file header). No deleted_at: revoking platform-admin access is a hard delete, not a soft one — there is no legitimate "restore" UX for this.';

alter table public.platform_admins enable row level security;

-- No RLS policy for `authenticated` at all, and no GRANT below — this
-- table is only ever read through is_platform_admin(), a SECURITY DEFINER
-- function that bypasses RLS. Belt-and-suspenders: even if a future bug
-- added a policy here, `authenticated` still has zero table-level
-- privilege without an explicit GRANT (same "GRANT is checked before RLS"
-- point already documented in SUPABASE_SCHEMA_PLAN.md).

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins
    where profile_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- =====================================================================
-- End of 0016_platform_admin_core.sql
-- =====================================================================
