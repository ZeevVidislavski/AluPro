-- =====================================================================
-- 0004_verify_users.sql
-- Run this in the SQL Editor to see, unambiguously, which auth.users
-- row belongs to which email — no guessing from the Dashboard UI.
-- =====================================================================

select id, email, created_at, last_sign_in_at
from auth.users
order by created_at;
