-- =====================================================================
-- 0004_projects_sequence_grant_fix.sql
--
-- Fixes a real bug caught by manual testing in the browser: creating a
-- project failed with "permission denied for sequence project_number_seq".
--
-- 0003_projects.sql's header comment claimed that authenticated does NOT
-- need USAGE on the sequence, because nextval() is called inside the
-- table's own DEFAULT expression, which "runs with the privileges of the
-- table owner". That claim was WRONG — Postgres still requires the
-- connecting role to have USAGE privilege on any sequence referenced by
-- nextval(), even when the call happens inside a column DEFAULT
-- expression evaluated during an INSERT. This is the second GRANT-related
-- gap found in this project (see 0002_grants_fix.sql for the first, on
-- the core Phase 1 tables) — the same category of mistake, just on a new
-- object type (SEQUENCE, not TABLE) that the general "grant explicit
-- privileges up front" lesson from Phase 1 didn't automatically cover.
--
-- Lesson for future entities: any sequence, function, or other object
-- referenced (directly or indirectly, including inside DEFAULT
-- expressions and trigger bodies) by a table's INSERT/UPDATE path needs
-- its own explicit GRANT to `authenticated` — GRANT on the table alone is
-- not transitive to objects it references.
-- =====================================================================

grant usage on sequence public.project_number_seq to authenticated;

-- =====================================================================
-- End of 0004_projects_sequence_grant_fix.sql
-- =====================================================================
