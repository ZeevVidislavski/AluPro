-- =====================================================================
-- 0009_seed_quote_for_delete_test.sql
-- Manual seed — one project_quote, purely to have something to test the
-- soft_delete_project_quote RPC / Quotes.jsx delete button against.
-- Links to whichever project already exists (P000001, from Phase 2/3
-- testing) and the existing tenant.
-- =====================================================================

insert into public.project_quotes (
  tenant_id, project_id, project_name, customer_name,
  addition_number, amount, status, created_by
)
select
  p.tenant_id,
  p.id,
  p.name,
  p.customer_name,
  0,
  15000,
  'draft',
  '23ffbb35-b5d2-47fc-9772-eb0a9d6d1e6b'
from public.projects p
order by p.created_at
limit 1;

-- Verification
select id, project_name, amount, status, deleted_at
from public.project_quotes;
