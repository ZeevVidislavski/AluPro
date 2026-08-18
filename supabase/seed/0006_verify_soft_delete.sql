-- =====================================================================
-- 0006_verify_soft_delete.sql
-- Confirms that "delete" in the UI performed a SOFT delete (deleted_at
-- set) via the soft_delete_customer RPC, not a real DELETE FROM row.
-- If this returns 0 rows, the customer was actually hard-deleted
-- somehow, which would be a real bug worth investigating.
-- =====================================================================

select id, name, phone, deleted_at, updated_at, updated_by
from public.customers
order by created_at desc;
