-- =====================================================================
-- 0007_verify_projects_table.sql
-- Quick sanity check that 0003_projects.sql applied cleanly: confirms
-- the table exists with the expected columns, RLS is enabled, and the
-- sequence exists. Read-only, no side effects.
-- =====================================================================

-- 1. Confirm the table + column list
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
order by ordinal_position;

-- 2. Confirm RLS is enabled
select relname, relrowsecurity
from pg_class
where relname = 'projects';

-- 3. Confirm the sequence exists and its current value
select last_value from public.project_number_seq;
