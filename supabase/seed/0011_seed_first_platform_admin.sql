-- =====================================================================
-- 0011_seed_first_platform_admin.sql
--
-- Grants Zeev (the platform owner) platform-admin access, so he can see
-- the super-admin console at /admin/tenants. Same chicken-and-egg
-- reasoning as the very first tenant/owner seed (0001_poc_seed.sql /
-- 0005_fix_membership_owner.sql): there is no self-service way to become
-- a platform admin (by design — see supabase/migrations/0016_platform
-- _admin_core.sql, no INSERT policy exists on platform_admins for
-- `authenticated` at all), so the first row must be inserted by hand with
-- an elevated connection (service_role / SQL Editor), bypassing RLS.
--
-- Zeev's profile id, confirmed via supabase/seed/0005_fix_membership
-- _owner.sql: 2c3b4b9b-43fb-465b-85fa-d747785caf32 -> 7147622@gmail.com
-- =====================================================================

insert into public.platform_admins (profile_id)
values ('2c3b4b9b-43fb-465b-85fa-d747785caf32')
on conflict (profile_id) do nothing;

-- =====================================================================
-- Verification
-- =====================================================================

select
  u.email,
  pa.created_at as platform_admin_since
from public.platform_admins pa
join auth.users u on u.id = pa.profile_id;
