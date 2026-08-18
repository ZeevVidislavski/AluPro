-- =====================================================================
-- 0008_company_headers.sql
-- Phase 6: CompanyHeader — full CRUD (list/create/update/delete-soft) +
-- Supabase Storage bucket for logo uploads (first Storage usage in this
-- project — see docs/PHASE_6_IMPLEMENTATION_PLAN.md section 3).
--
-- logo_url stores an internal Storage path (e.g.
-- "{tenant_id}/company-headers/{header_id}/{timestamp}_logo.png"), NOT a
-- public URL like Base44's Core.UploadFile returned. Display requires a
-- signed URL generated at read time (1 hour validity) — see
-- CompanyHeaderService.getLogoUrl() in the application code.
--
-- Storage RLS syntax/behavior (storage.foldername(), grants on
-- storage.objects) is NOT verified against a live Supabase project in
-- this file — flagged explicitly per the Phase 2 lesson (don't assert
-- claims about permissions without testing them). Review carefully
-- before relying on it.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. company_headers
-- =====================================================================

create table public.company_headers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  name          text not null,
  company_name  text,
  logo_url      text,  -- internal Storage path, not a public URL — see file header
  subtitle      text,
  is_default    boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index company_headers_tenant_id_idx on public.company_headers (tenant_id) where deleted_at is null;

comment on table public.company_headers is 'Maps 1:1 to base44/entities/CompanyHeader.jsonc. logo_url is an internal Storage path (company-logos bucket), not a public URL — Base44''s Core.UploadFile returned a permanent public URL; this is a deliberate security improvement (private bucket + signed URLs), matching the recommendation already made in STORAGE_MIGRATION.md. No FK to any other table — CompanyHeader is a tenant-global entity, same as it was global in Base44.';

-- =====================================================================
-- 2. protect_immutable_columns_company_headers trigger + soft-delete RPC
--
-- Same pattern as customers/project_quotes: GUC bypass flag for the RPC,
-- unconditional block otherwise.
-- =====================================================================

create or replace function public.protect_immutable_columns_company_headers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id cannot be changed';
  end if;

  if new.deleted_at is distinct from old.deleted_at
     and coalesce(current_setting('app.allow_deleted_at_change', true), 'off') <> 'on' then
    raise exception 'deleted_at must be changed via soft_delete_company_header()';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger company_headers_protect_immutable
  before update on public.company_headers
  for each row execute function public.protect_immutable_columns_company_headers();

create or replace function public.soft_delete_company_header(header_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.company_headers where id = header_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Company header not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this company header';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.company_headers set deleted_at = now(), updated_by = auth.uid() where id = header_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

-- No restore RPC yet — no restore UI exists, same "don't build ahead of
-- actual usage" principle applied throughout this project.

-- =====================================================================
-- 3. Enable RLS on company_headers
-- =====================================================================

alter table public.company_headers enable row level security;

create policy company_headers_select on public.company_headers
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy company_headers_insert on public.company_headers
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

-- Single UPDATE policy — covers both regular field edits AND the
-- setDefault "unset all others, set one" pattern from CompanyHeaders.jsx
-- (each individual row update still goes through this same policy).
create policy company_headers_update on public.company_headers
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

grant select, insert, update on public.company_headers to authenticated;
grant execute on function public.soft_delete_company_header(uuid) to authenticated;

-- =====================================================================
-- 4. Storage bucket — company-logos (PRIVATE, not public)
--
-- Deliberately private, unlike Base44's permanent public URLs — matches
-- the recommendation already documented in STORAGE_MIGRATION.md
-- ("private bucket + signed URLs", section 2).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', false)
on conflict (id) do nothing;

-- =====================================================================
-- 5. Storage RLS policies on storage.objects
--
-- Path convention: {tenant_id}/company-headers/{header_id}/{filename}
-- storage.foldername(name) splits the object path into an array by "/"
-- — the first element is expected to be the tenant_id. This is the
-- standard Supabase Storage RLS pattern, but has NOT been verified
-- against a live project in this repo — see file header warning.
-- =====================================================================

create policy company_logos_select on storage.objects
  for select using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] in (
      select public.user_tenant_ids()::text
    )
  );

create policy company_logos_insert on storage.objects
  for insert with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] in (
      select public.user_tenant_ids()::text
    )
  );

-- No UPDATE/DELETE storage policy — uploads are treated as write-once in
-- this phase (a new upload creates a new path with a fresh timestamp,
-- rather than overwriting). "Remove logo" only nulls company_headers.
-- logo_url (see PHASE_6_IMPLEMENTATION_PLAN.md decision 3) — it does not
-- delete the underlying Storage object, so no DELETE policy is needed
-- yet either.

-- =====================================================================
-- End of 0008_company_headers.sql
-- =====================================================================
