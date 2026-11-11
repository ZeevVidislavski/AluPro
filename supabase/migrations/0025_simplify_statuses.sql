-- =====================================================================
-- 0025_simplify_statuses.sql
-- Project statuses are reduced to draft / approved / completed and quote
-- statuses to draft / approved.
--   * A project is created as 'draft'; approving one of its quotes makes it
--     'approved'; closing its settlement makes it 'completed'.
--   * Quotes are approved only through the "approve" button in the
--     project's quote grid.
-- Existing rows are mapped before the new CHECK constraints are added.
-- =====================================================================

-- ---- projects ----
alter table public.projects drop constraint if exists projects_status_check;

update public.projects set status = case
  when status in ('quote', 'negotiation') then 'draft'
  when status in ('approved', 'ordering', 'production', 'installation') then 'approved'
  when status in ('completed', 'invoiced') then 'completed'
  else status
end;

alter table public.projects alter column status set default 'draft';
alter table public.projects
  add constraint projects_status_check check (status in ('draft', 'approved', 'completed'));

-- ---- project_quotes ----
alter table public.project_quotes drop constraint if exists project_quotes_status_check;

update public.project_quotes set status = 'draft' where status in ('sent', 'rejected');

alter table public.project_quotes
  add constraint project_quotes_status_check check (status in ('draft', 'approved'));
