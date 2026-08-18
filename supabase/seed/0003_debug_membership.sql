-- =====================================================================
-- 0003_debug_membership.sql
-- Diagnostic query for the "No active tenant membership found for this
-- user" error seen when creating a customer via the Customers.jsx PoC.
--
-- Run each query separately in the SQL Editor and check the results.
-- =====================================================================

-- 1. Confirm the user's auth.users row and its id — this should match
--    2c3b4b9b-43fb-465b-85fa-d747785caf32 for r.yustman2501@gmail.com.
select id, email from auth.users where email = 'r.yustman2501@gmail.com';

-- 2. Confirm the profile row exists for that id.
select id, full_name from public.profiles where id = '2c3b4b9b-43fb-465b-85fa-d747785caf32';

-- 3. Confirm the membership row exists and is not soft-deleted.
select id, tenant_id, profile_id, role, deleted_at
from public.tenant_memberships
where profile_id = '2c3b4b9b-43fb-465b-85fa-d747785caf32';

-- 4. IMPORTANT: run this specific query AS the logged-in user, not as
--    service_role. In the Supabase SQL Editor, queries run with elevated
--    privileges by default (bypassing RLS) — so queries 1-3 above will
--    "succeed" even if RLS would normally block them for the app. This
--    query simulates what the app's RLS-protected query actually sees:
--
--    select public.user_tenant_ids();
--
-- This function reads auth.uid() internally, which is NULL when run
-- from the SQL Editor (there's no real authenticated session there) —
-- so this will likely return an EMPTY result even if everything is
-- seeded correctly. This is expected and NOT a sign of a real bug by
-- itself; it only proves the function works when there's no session,
-- which isn't the real failure scenario. Use it only to confirm the
-- function itself runs without SQL errors.
select public.user_tenant_ids();
