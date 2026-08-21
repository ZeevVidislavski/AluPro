-- =====================================================================
-- 0021_storage_platform_admin_bypass.sql
-- M6 (Feature B, part 1/1): let a platform admin list any tenant's
-- Storage objects, for the on-demand "חשב שימוש אחסון" button on
-- PlatformTenantDetail.jsx.
--
-- Storage-objects equivalent of 0018_platform_admin_rls_bypass.sql. That
-- migration only touched ordinary tables (tenants, tenant_memberships,
-- profiles, customers, projects) — storage.objects RLS is a separate
-- policy surface and was never given a platform-admin branch, so Zeev
-- (not a member of the tenant he's inspecting) currently gets an empty
-- list() result for any tenant but his own.
--
-- Read-only, same as 0018: no INSERT/UPDATE/DELETE policy touched here.
-- A platform admin gains no new ability to upload/modify/delete a
-- tenant's files through this migration — only to enumerate them (and
-- their sizes) for the storage-usage calculation.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

drop policy project_files_select on storage.objects;

create policy project_files_select on storage.objects
  for select using (
    bucket_id = 'project-files'
    and (
      (storage.foldername(name))[1] in (select public.user_tenant_ids()::text)
      or public.is_platform_admin()
    )
  );

drop policy company_logos_select on storage.objects;

create policy company_logos_select on storage.objects
  for select using (
    bucket_id = 'company-logos'
    and (
      (storage.foldername(name))[1] in (select public.user_tenant_ids()::text)
      or public.is_platform_admin()
    )
  );

-- =====================================================================
-- End of 0021_storage_platform_admin_bypass.sql
-- =====================================================================
