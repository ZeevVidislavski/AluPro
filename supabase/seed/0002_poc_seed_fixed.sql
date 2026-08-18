-- =====================================================================
-- 0002_poc_seed_fixed.sql
-- Fixed, single-statement seed — avoids the copy/paste-between-steps
-- mistake that caused the tenant_memberships_tenant_id_fkey violation
-- when running 0001_poc_seed.sql (the tenant's own id was pasted into
-- the tenant_id column instead of the tenant row's actual generated id).
--
-- BEFORE RUNNING THIS: run the verification query at the bottom of this
-- file FIRST (as its own query) to check what 0001_poc_seed.sql already
-- created, so we don't create duplicate rows. Steps 1 (profiles insert)
-- and 2 (tenants insert) in 0001_poc_seed.sql likely succeeded before
-- step 3 failed — only step 3 (tenant_memberships) is missing.
-- =====================================================================

-- ═══════════════════════════════════════════════════════
-- STEP 0 — RUN THIS FIRST, ALONE, TO CHECK CURRENT STATE
-- ═══════════════════════════════════════════════════════

-- select id, full_name from public.profiles;
-- select id, name, slug from public.tenants;
-- select * from public.tenant_memberships;

-- ═══════════════════════════════════════════════════════
-- If the check above shows:
--   - a profile row exists with id = '2c3b4b9b-43fb-465b-85fa-d747785caf32'
--   - a tenant row exists with slug = 'alupro-demo'
--   - tenant_memberships is EMPTY
-- ...then run ONLY this (replace <TENANT_ID_FROM_CHECK> with the real
-- id you see in the tenants query above):
-- ═══════════════════════════════════════════════════════

-- insert into public.tenant_memberships (tenant_id, profile_id, role)
-- values (
--   '<TENANT_ID_FROM_CHECK>',
--   '2c3b4b9b-43fb-465b-85fa-d747785caf32',
--   'owner'
-- );

-- ═══════════════════════════════════════════════════════
-- If instead nothing exists yet (clean slate — e.g. you want to start
-- over), this single CTE statement does all 3 steps atomically and
-- can't suffer the copy/paste mistake, because it never leaves SQL:
-- ═══════════════════════════════════════════════════════

with new_tenant as (
  insert into public.tenants (name, slug, status)
  values ('AluPro Demo', 'alupro-demo', 'active')
  returning id
),
ensured_profile as (
  insert into public.profiles (id, full_name)
  values ('2c3b4b9b-43fb-465b-85fa-d747785caf32', 'Seed Owner')
  on conflict (id) do nothing
  returning id
)
insert into public.tenant_memberships (tenant_id, profile_id, role)
select new_tenant.id, '2c3b4b9b-43fb-465b-85fa-d747785caf32', 'owner'
from new_tenant;

-- ═══════════════════════════════════════════════════════
-- Verification — run after either path above to confirm the full chain
-- ═══════════════════════════════════════════════════════

select
  t.name as tenant_name,
  t.slug,
  p.full_name,
  tm.role
from public.tenant_memberships tm
join public.tenants t on t.id = tm.tenant_id
join public.profiles p on p.id = tm.profile_id
where tm.deleted_at is null;
