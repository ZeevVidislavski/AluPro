-- =====================================================================
-- 0012_project_details.sql
-- Phase 10a: ProjectDetails.jsx — full CRUD on 6 of its 7 entities
-- (Project, ClientPayment, SupplierOrder, ProjectQuote, Reminder,
-- Document). Partner stays read-only (list() already exists and is
-- sufficient — ProjectDetails.jsx only reads it for payment/order
-- dropdowns).
--
-- MaterialOrder/MaterialOrderItem are explicitly OUT of scope — the
-- "Material Orders" tab (MaterialOrdersTab.jsx) depends on
-- QuoteItem/QuoteItemComponent, which belong to QuoteEditor.jsx and are
-- handled in 0013_quote_editor.sql. See
-- docs/PHASE_10_IMPLEMENTATION_PLAN.md section 1.
--
-- Extends 4 EXISTING tables (projects, client_payments, supplier_orders,
-- project_quotes, reminders — no ALTER TABLE on any of them, all columns
-- needed already exist from Phase 1-5) with new policies/RPCs/GRANTs,
-- plus one new table (documents) and one new shared Storage bucket
-- (project-files, shared between project_quotes and documents file
-- uploads — see PHASE_10_IMPLEMENTATION_PLAN.md section 3.6).
--
-- IMPORTANT: the existing protect_immutable_columns_reminders trigger
-- (0007_reminders.sql) blocks ANY deleted_at change unconditionally (no
-- GUC-bypass flag, because no soft-delete RPC existed when it was
-- written). This migration REPLACES that function to add the bypass
-- flag, matching every other soft-deletable table. This is the one
-- place in this file that changes existing trigger behavior, not just
-- adds new objects — verify reminder deletion works after running this.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. projects — add UPDATE policy + soft-delete RPC
-- (existing protect_immutable_columns_projects trigger, from 0003,
-- already supports the GUC-bypass pattern — no changes needed there)
-- =====================================================================

create policy projects_update on public.projects
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

create or replace function public.soft_delete_project(project_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.projects where id = project_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Project not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this project';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.projects set deleted_at = now(), updated_by = auth.uid() where id = project_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

grant update on public.projects to authenticated;
grant execute on function public.soft_delete_project(uuid) to authenticated;

-- =====================================================================
-- 2. client_payments — add full CRUD (was SELECT-only since 0005)
-- =====================================================================

create or replace function public.protect_immutable_columns_client_payments()
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
    raise exception 'deleted_at must be changed via soft_delete_client_payment()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger client_payments_protect_immutable
  before update on public.client_payments
  for each row execute function public.protect_immutable_columns_client_payments();

create or replace function public.soft_delete_client_payment(payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.client_payments where id = payment_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Payment not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this payment';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.client_payments set deleted_at = now(), updated_by = auth.uid() where id = payment_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create policy client_payments_insert on public.client_payments
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and project_id in (
      select id from public.projects
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy client_payments_update on public.client_payments
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

grant insert, update on public.client_payments to authenticated;
grant execute on function public.soft_delete_client_payment(uuid) to authenticated;

-- =====================================================================
-- 3. supplier_orders — add full CRUD (was SELECT-only since 0005)
-- =====================================================================

create or replace function public.protect_immutable_columns_supplier_orders()
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
    raise exception 'deleted_at must be changed via soft_delete_supplier_order()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger supplier_orders_protect_immutable
  before update on public.supplier_orders
  for each row execute function public.protect_immutable_columns_supplier_orders();

create or replace function public.soft_delete_supplier_order(order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.supplier_orders where id = order_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Order not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this order';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.supplier_orders set deleted_at = now(), updated_by = auth.uid() where id = order_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create policy supplier_orders_insert on public.supplier_orders
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and project_id in (
      select id from public.projects
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy supplier_orders_update on public.supplier_orders
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

grant insert, update on public.supplier_orders to authenticated;
grant execute on function public.soft_delete_supplier_order(uuid) to authenticated;

-- =====================================================================
-- 4. project_quotes — add INSERT/UPDATE (was SELECT+soft-delete only
-- since Phase 4/0006). The existing protect_immutable_columns_
-- project_quotes trigger already supports the GUC-bypass pattern — no
-- changes needed there.
--
-- This does NOT conflict with Quotes.jsx (Phase 4), which deliberately
-- keeps create/update on Base44 for its own "new quote" flow (cross-
-- system UUID risk with QuoteEditor.jsx — see
-- PHASE_4_IMPLEMENTATION_PLAN.md section 9). ProjectDetails.jsx's
-- QuotesSection never navigates to QuoteEditor.jsx after create/update,
-- so it does not have that risk — see PHASE_10_IMPLEMENTATION_PLAN.md
-- section 2 for the full reasoning. Both screens now read/write the
-- same table; only ProjectDetails.jsx's Service layer exposes create/
-- update.
-- =====================================================================

create policy project_quotes_insert on public.project_quotes
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and project_id in (
      select id from public.projects
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy project_quotes_update on public.project_quotes
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

grant insert, update on public.project_quotes to authenticated;

-- =====================================================================
-- 5. reminders — add DELETE (soft, RPC). The existing trigger (0007)
-- blocks ANY deleted_at change unconditionally — REPLACING it here to
-- add the GUC-bypass flag, since a soft-delete RPC now exists. This is
-- the one behavior change to an existing trigger in this file.
-- =====================================================================

create or replace function public.protect_immutable_columns_reminders()
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
    raise exception 'deleted_at must be changed via soft_delete_reminder()';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;
-- Trigger itself is unchanged (still points at the same function name),
-- only the function body changed — no need to drop/recreate the trigger.

create or replace function public.soft_delete_reminder(reminder_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.reminders where id = reminder_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Reminder not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this reminder';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.reminders set deleted_at = now(), updated_by = auth.uid() where id = reminder_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

grant execute on function public.soft_delete_reminder(uuid) to authenticated;

-- =====================================================================
-- 6. documents — new table, full CRUD
-- =====================================================================

create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  project_id     uuid not null references public.projects(id),
  project_name   text,

  document_type  text not null check (document_type in ('contract','plan','invoice','photo','delivery')),
  name           text not null,
  file_url       text not null,  -- internal Storage path, not a public URL — see section 8 below
  notes          text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index documents_tenant_id_idx on public.documents (tenant_id) where deleted_at is null;
create index documents_project_id_idx on public.documents (project_id) where deleted_at is null;

comment on table public.documents is 'Maps 1:1 to base44/entities/Document.jsonc. file_url is an internal Storage path (project-files bucket), not a public URL — same pattern as company_headers.logo_url (Phase 6). Full CRUD via ProjectDetails.jsx > DocumentsSection.';

create or replace function public.protect_immutable_columns_documents()
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
    raise exception 'deleted_at must be changed via soft_delete_document()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger documents_protect_immutable
  before update on public.documents
  for each row execute function public.protect_immutable_columns_documents();

create or replace function public.soft_delete_document(document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.documents where id = document_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Document not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this document';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.documents set deleted_at = now(), updated_by = auth.uid() where id = document_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

alter table public.documents enable row level security;

create policy documents_select on public.documents
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy documents_insert on public.documents
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and project_id in (
      select id from public.projects
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy documents_update on public.documents
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

grant select, insert, update on public.documents to authenticated;
grant execute on function public.soft_delete_document(uuid) to authenticated;

-- =====================================================================
-- 7. project_number... N/A, skip. GRANT summary already inline above.
-- =====================================================================

-- =====================================================================
-- 8. Storage bucket — project-files (PRIVATE, shared between
-- project_quotes.file_url and documents.file_url)
--
-- Path convention: {tenant_id}/project-quotes/{quote_id}/{timestamp}_{filename}
--                   {tenant_id}/documents/{document_id}/{timestamp}_{filename}
-- Same private-bucket + signed-URL pattern as company-logos (Phase 6),
-- verified working there. Not re-verified against a live project here —
-- same caution as every new Storage object in this codebase.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy project_files_select on storage.objects
  for select using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] in (
      select public.user_tenant_ids()::text
    )
  );

create policy project_files_insert on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] in (
      select public.user_tenant_ids()::text
    )
  );

-- No UPDATE/DELETE storage policy — same write-once pattern as
-- company-logos (Phase 6): a new upload creates a new path with a fresh
-- timestamp rather than overwriting; "delete" only nulls/changes the
-- DB row's file_url, doesn't remove the underlying object.

-- =====================================================================
-- End of 0012_project_details.sql
-- =====================================================================
