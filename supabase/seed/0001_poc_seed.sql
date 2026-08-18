-- =====================================================================
-- 0001_poc_seed.sql
-- Manual seed for Phase 1 PoC — one tenant + one owner membership.
--
-- This is NOT run automatically as part of 0001_poc_core.sql. It is meant
-- to be run once, manually, via the Supabase SQL Editor, AFTER:
--   1. 0001_poc_core.sql has been applied successfully, and
--   2. a first user has been created via Supabase Auth (Dashboard ->
--      Authentication -> Users -> Add user, or a real signup flow).
--
-- Per ADR-04/ADR-12 (docs/ARCHITECTURE_DECISIONS.md): there is no real
-- production data to migrate, so this seed exists purely to have
-- something to test the PoC against — not to represent a real customer.
--
-- HOW TO USE:
--   1. Create a user in Supabase Auth (Dashboard or supabase.auth.signUp).
--   2. Copy that user's UUID from Authentication -> Users.
--   3. Replace the placeholder '00000000-0000-0000-0000-000000000000'
--      below with that real UUID.
--   4. Run this whole file in the SQL Editor (uses service_role context
--      there, so it bypasses RLS — that's expected and fine for a
--      one-time manual seed).
-- =====================================================================

-- Step 1: create the profile row for the user.
-- (In a real signup flow this would be created automatically by a trigger
-- on auth.users; for the PoC seed we do it manually since we're not
-- wiring that trigger up yet — Login.jsx / AuthContext work, not schema.)
insert into public.profiles (id, full_name)
values ('00000000-0000-0000-0000-000000000000', 'Seed Owner')
on conflict (id) do nothing;

-- Step 2: create the tenant.
insert into public.tenants (name, slug, status)
values ('AluPro Demo', 'alupro-demo', 'active')
returning id;
-- ^ copy the returned id and paste it into step 3 below, OR run step 3
--   as a single statement using a CTE (see combined version further down).

-- Step 3: create the membership linking the user to the tenant as owner.
-- Replace both placeholder UUIDs with the real user id and the tenant id
-- returned from step 2.
insert into public.tenant_memberships (tenant_id, profile_id, role)
values (
  '11111111-1111-1111-1111-111111111111', -- tenant id from step 2
  '00000000-0000-0000-0000-000000000000', -- user id from Supabase Auth
  'owner'
);

-- =====================================================================
-- Alternative: single-statement version (avoids manual copy/paste of the
-- tenant id between steps). Still requires replacing the user UUID.
-- =====================================================================
--
-- with new_tenant as (
--   insert into public.tenants (name, slug, status)
--   values ('AluPro Demo', 'alupro-demo', 'active')
--   returning id
-- ),
-- new_profile as (
--   insert into public.profiles (id, full_name)
--   values ('00000000-0000-0000-0000-000000000000', 'Seed Owner')
--   on conflict (id) do nothing
--   returning id
-- )
-- insert into public.tenant_memberships (tenant_id, profile_id, role)
-- select new_tenant.id, '00000000-0000-0000-0000-000000000000', 'owner'
-- from new_tenant;
--
-- Note: if the profile already existed (on conflict do nothing skipped
-- the insert), `new_profile` returns no row, but the membership insert
-- below uses the literal UUID directly, not new_profile.id, so it still
-- works either way.

-- =====================================================================
-- Verification query — run after seeding to confirm the chain is correct.
-- =====================================================================
--
-- select
--   t.name as tenant_name,
--   t.slug,
--   p.full_name,
--   tm.role
-- from public.tenant_memberships tm
-- join public.tenants t on t.id = tm.tenant_id
-- join public.profiles p on p.id = tm.profile_id
-- where tm.deleted_at is null;
