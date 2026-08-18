-- =====================================================================
-- 0011_general_expenses_and_partner_delete.sql
-- Phase 9: GeneralExpense (new table, full CRUD) + a missing
-- soft_delete_partner RPC on the existing partners table (0005).
--
-- PartnerSettlement.jsx (finance/PartnerSettlement.jsx) does full CRUD
-- on Partner, including delete — a gap noted but not fixed back in Phase
-- 3 (PartnerService only had list/create/update, since Finance.jsx and
-- Dashboard.jsx never deleted a partner). This migration only adds a new
-- RPC + GRANT to the EXISTING partners table — no ALTER TABLE, the
-- protect_immutable_columns_partners trigger from 0005 already supports
-- the GUC-bypass pattern this RPC needs, unchanged.
--
-- paid_by_partner_id on general_expenses is a loose text field, not a
-- uuid FK to partners — matches base44/entities/GeneralExpense.jsonc,
-- which never enforced that relationship either.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. general_expenses
-- =====================================================================

create table public.general_expenses (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,

  description            text not null,
  category               text not null default 'other'
                           check (category in ('rent','salary','equipment','marketing','other')),
  amount                 numeric not null,
  expense_date           date not null,
  paid_by_partner_id     text,
  paid_by_partner_name   text,
  notes                  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index general_expenses_tenant_id_idx on public.general_expenses (tenant_id) where deleted_at is null;

comment on table public.general_expenses is 'Maps 1:1 to base44/entities/GeneralExpense.jsonc. paid_by_partner_id is a loose text field (not a uuid FK) — matches the original Base44 schema, which never enforced that relationship.';

-- =====================================================================
-- 2. protect_immutable_columns_general_expenses trigger + soft-delete RPC
-- (same GUC-flag pattern as customers/project_quotes/company_headers)
-- =====================================================================

create or replace function public.protect_immutable_columns_general_expenses()
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
    raise exception 'deleted_at must be changed via soft_delete_general_expense()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger general_expenses_protect_immutable
  before update on public.general_expenses
  for each row execute function public.protect_immutable_columns_general_expenses();

create or replace function public.soft_delete_general_expense(expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.general_expenses where id = expense_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Expense not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this expense';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.general_expenses set deleted_at = now(), updated_by = auth.uid() where id = expense_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

-- =====================================================================
-- 3. RLS + GRANT — general_expenses
-- =====================================================================

alter table public.general_expenses enable row level security;

create policy general_expenses_select on public.general_expenses
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy general_expenses_insert on public.general_expenses
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy general_expenses_update on public.general_expenses
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

grant select, insert, update on public.general_expenses to authenticated;
grant execute on function public.soft_delete_general_expense(uuid) to authenticated;

-- =====================================================================
-- 4. soft_delete_partner RPC — NEW function on the EXISTING partners
-- table from 0005_partners_payments_orders.sql. No ALTER TABLE: that
-- table already has deleted_at/created_by/tenant_id, and its
-- protect_immutable_columns_partners trigger already supports the
-- app.allow_deleted_at_change GUC-bypass pattern this RPC relies on
-- (verify this against the live trigger before relying on it — see
-- docs/PHASE_9_IMPLEMENTATION_PLAN.md section 2 for the explicit caveat;
-- this was checked by reading 0005's source, not against a live DB).
-- =====================================================================

create or replace function public.soft_delete_partner(partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.partners where id = partner_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Partner not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this partner';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.partners set deleted_at = now(), updated_by = auth.uid() where id = partner_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

grant execute on function public.soft_delete_partner(uuid) to authenticated;

-- =====================================================================
-- End of 0011_general_expenses_and_partner_delete.sql
-- =====================================================================
