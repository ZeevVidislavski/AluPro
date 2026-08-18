-- =====================================================================
-- 0010_verify_soft_delete_quote.sql
-- Confirms the quote deleted via the UI still exists in the table with
-- deleted_at set (soft delete via RPC), not actually removed.
-- =====================================================================

select id, project_name, amount, status, deleted_at, updated_by
from public.project_quotes
order by created_at desc;
