-- =====================================================================
-- 0008_seed_partner.sql
-- Manual seed for Phase 3 testing — one partner, linked to the existing
-- tenant/owner from Phase 1 (see supabase/seed/0005_fix_membership_
-- owner.sql for the real user UUID: 23ffbb35-b5d2-47fc-9772-eb0a9d6d1e6b,
-- r.yustman2501@gmail.com).
--
-- Per ADR-12: no real production data to migrate — this is purely to
-- have something to test Dashboard/Finance/Projects against.
-- =====================================================================

insert into public.partners (tenant_id, name, profit_share_percent, created_by)
select t.id, 'שותף בדיקה', 50, '23ffbb35-b5d2-47fc-9772-eb0a9d6d1e6b'
from public.tenants t
where t.slug = 'alupro-demo';

-- =====================================================================
-- Verification
-- =====================================================================

select id, name, profit_share_percent, active
from public.partners;
