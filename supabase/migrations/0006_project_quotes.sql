-- =====================================================================
-- 0006_project_quotes.sql
-- Phase 4: ProjectQuote — list + soft-delete only. create/update remain
-- on Base44 (Quotes.jsx's create flow navigates immediately to
-- QuoteEditor.jsx by id, which hasn't migrated — creating in Supabase
-- would produce a UUID QuoteEditor can't find, breaking that screen; see
-- docs/PHASE_4_IMPLEMENTATION_PLAN.md section 9 for the full reasoning
-- behind this scope decision).
--
-- Lessons applied from Phase 1-3: GRANT included from the start; soft
-- delete via RPC (not direct UPDATE), same pattern as
-- soft_delete_customer in 0001_poc_core.sql.
--
-- This file has not been run against any Supabase project. Review it
-- (and ideally a local `supabase db reset`) before applying.
-- =====================================================================

-- =====================================================================
-- 1. project_quotes
-- =====================================================================

create table public.project_quotes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  project_id      uuid not null references public.projects(id),
  project_name    text,
  customer_name   text,
  quote_number    text,
  addition_number integer not null,
  quote_date      date,
  valid_until     date,

  amount            numeric(12,2) not null,
  subtotal          numeric(12,2),
  discount_percent  numeric(5,2) not null default 0,
  vat_percent       numeric(5,2) not null default 17,
  vat_amount        numeric(12,2),
  total_with_vat    numeric(12,2),

  changes_description  text,
  notes                text,
  file_url             text,

  status       text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected')),
  is_detailed  boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index project_quotes_tenant_id_idx on public.project_quotes (tenant_id) where deleted_at is null;
create index project_quotes_project_id_idx on public.project_quotes (project_id) where deleted_at is null;

comment on table public.project_quotes is 'Maps 1:1 to base44/entities/ProjectQuote.jsonc. Phase 4 scope is list+delete only via Quotes.jsx — create/update remain on Base44 (see file header). No unique constraint on (project_id, addition_number) yet — that fix is deferred together with create, since addition_number is only assigned at creation time (see PHASE_4_IMPLEMENTATION_PLAN.md, originally section 5, now deferred).';

-- =====================================================================
-- 2. soft_delete_project_quote RPC
--
-- Same session-local GUC flag pattern as soft_delete_customer (see
-- 0001_poc_core.sql section 7) — reused deliberately, not reinvented,
-- since it's the established convention for this project.
-- =====================================================================

create or replace function public.protect_immutable_columns_project_quotes()
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
    raise exception 'deleted_at must be changed via soft_delete_project_quote()';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger project_quotes_protect_immutable
  before update on public.project_quotes
  for each row execute function public.protect_immutable_columns_project_quotes();

create or replace function public.soft_delete_project_quote(quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.project_quotes where id = quote_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Quote not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this quote';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.project_quotes set deleted_at = now(), updated_by = auth.uid() where id = quote_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

-- No restore_project_quote RPC yet — no restore UI exists, matching the
-- "don't build ahead of actual usage" principle applied throughout this
-- project. Add when needed, following the same pattern.

-- =====================================================================
-- 3. Enable RLS
-- =====================================================================

alter table public.project_quotes enable row level security;

-- =====================================================================
-- 4. RLS policies — SELECT only. No INSERT/UPDATE policy: create/update
-- remain on Base44 in this phase (see file header). Soft delete goes
-- through the RPC above, which is SECURITY DEFINER and bypasses RLS
-- internally — no DELETE/UPDATE policy is needed for that path either.
-- =====================================================================

create policy project_quotes_select on public.project_quotes
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

-- =====================================================================
-- 5. GRANT — included from the start (Phase 2 lesson). Only SELECT and
-- EXECUTE on the RPC — no INSERT/UPDATE/DELETE grant on the table
-- itself, matching the scope decision (create/update on Base44; delete
-- only through the RPC, which runs as SECURITY DEFINER and doesn't need
-- a table-level DELETE grant for the connecting role).
-- =====================================================================

grant select on public.project_quotes to authenticated;
grant execute on function public.soft_delete_project_quote(uuid) to authenticated;

-- =====================================================================
-- End of 0006_project_quotes.sql
-- =====================================================================
