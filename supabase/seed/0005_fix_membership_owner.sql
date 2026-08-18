-- =====================================================================
-- 0005_fix_membership_owner.sql
--
-- Fixes a misidentification bug: the original seed (0002_poc_seed_fixed
-- .sql) linked the tenant's owner membership to profile_id
-- 2c3b4b9b-43fb-465b-85fa-d747785caf32, which was WRONGLY believed to be
-- r.yustman2501@gmail.com. Verified directly via `select id, email from
-- auth.users` that the real mapping is the opposite:
--
--   23ffbb35-b5d2-47fc-9772-eb0a9d6d1e6b  ->  r.yustman2501@gmail.com  (the real user)
--   2c3b4b9b-43fb-465b-85fa-d747785caf32  ->  7147622@gmail.com        (wrongly seeded as owner)
--
-- This creates a profile row for the correct user (if it doesn't exist
-- yet — a real signup flow would do this automatically via a trigger,
-- which isn't wired up yet for this PoC) and gives them the owner
-- membership on the existing "AluPro Demo" tenant.
-- =====================================================================

-- Step 1: ensure a profile row exists for the real user.
insert into public.profiles (id, full_name)
values ('23ffbb35-b5d2-47fc-9772-eb0a9d6d1e6b', 'Rachel Yustman')
on conflict (id) do nothing;

-- Step 2: grant them owner membership on the existing tenant.
insert into public.tenant_memberships (tenant_id, profile_id, role)
select t.id, '23ffbb35-b5d2-47fc-9772-eb0a9d6d1e6b', 'owner'
from public.tenants t
where t.slug = 'alupro-demo'
on conflict (tenant_id, profile_id) do update set role = 'owner', deleted_at = null;

-- =====================================================================
-- Verification — confirm both users' membership status
-- =====================================================================

select
  u.email,
  tm.role,
  tm.deleted_at as membership_deleted_at,
  t.name as tenant_name
from auth.users u
left join public.tenant_memberships tm on tm.profile_id = u.id
left join public.tenants t on t.id = tm.tenant_id
order by u.email;
