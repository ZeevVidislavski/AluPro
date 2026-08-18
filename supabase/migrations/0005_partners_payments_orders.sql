-- =====================================================================
-- 0005_partners_payments_orders.sql
-- Phase 3: Partner (full CRUD) + ClientPayment + SupplierOrder
-- (list/select only — no create/update/delete UI for these two in this
-- phase; ProjectDetails.jsx, which does full CRUD on them, has NOT
-- migrated). See docs/PHASE_3_IMPLEMENTATION_PLAN.md.
--
-- Lessons applied from Phase 2 (see PHASE_2_IMPLEMENTATION_PLAN.md
-- section 7 and SUPABASE_SCHEMA_PLAN.md section 10.4): GRANT is
-- explicit and included here for every object actually referenced by
-- an INSERT/UPDATE/SELECT path — not just the tables themselves.
--
-- This file has not been run against any Supabase project. Review it
-- (and ideally a local `supabase db reset`) before applying.
-- =====================================================================

-- =====================================================================
-- 1. partners
-- =====================================================================

create table public.partners (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,

  name                  text not null,
  profit_share_percent  numeric(5,2) not null check (profit_share_percent between 0 and 100),
  active                boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index partners_tenant_id_idx on public.partners (tenant_id) where deleted_at is null;

comment on table public.partners is 'Maps 1:1 to base44/entities/Partner.jsonc. profit_share_percent is a percentage (0-100), not a monetary amount — numeric(5,2), not numeric(12,2) like money fields. Migrated now (not deferred) specifically because client_payments.received_by_partner_id and supplier_orders.paid_by_partner_id need a real FK target — see PHASE_3_IMPLEMENTATION_PLAN.md section 0.';

-- =====================================================================
-- 2. client_payments (SELECT only — no create/update/delete UI in this
-- phase; ProjectDetails.jsx does full CRUD but hasn't migrated)
-- =====================================================================

create table public.client_payments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  project_id      uuid not null references public.projects(id),
  project_name    text,
  payment_type    text not null check (payment_type in ('advance', 'interim', 'final')),
  amount          numeric(12,2) not null,
  payment_date    date not null,
  payment_method  text check (payment_method in ('cash', 'check', 'transfer', 'credit')),

  received_by_partner_id    uuid references public.partners(id),
  received_by_partner_name  text,

  reference   text,
  notes       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index client_payments_tenant_id_idx on public.client_payments (tenant_id) where deleted_at is null;
create index client_payments_project_id_idx on public.client_payments (project_id) where deleted_at is null;

comment on table public.client_payments is 'Maps 1:1 to base44/entities/ClientPayment.jsonc. received_by_partner_id is a real FK to public.partners (not a loose string like Base44). No INSERT/UPDATE/DELETE RLS policy or GRANT in this phase — read-only until ProjectDetails.jsx (which performs full CRUD) is planned.';

-- =====================================================================
-- 3. supplier_orders (SELECT only — same reasoning as client_payments)
-- =====================================================================

create table public.supplier_orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  project_id      uuid not null references public.projects(id),
  project_name    text,
  order_type      text not null check (order_type in ('aluminum', 'hardware', 'glass', 'extras')),
  supplier_name   text not null,
  description     text,
  order_amount    numeric(12,2) not null,
  paid_amount     numeric(12,2) not null default 0,
  order_date      date,
  payment_date    date,

  paid_by_partner_id    uuid references public.partners(id),
  paid_by_partner_name  text,

  status  text not null default 'ordered' check (status in ('ordered', 'partial', 'paid', 'received')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index supplier_orders_tenant_id_idx on public.supplier_orders (tenant_id) where deleted_at is null;
create index supplier_orders_project_id_idx on public.supplier_orders (project_id) where deleted_at is null;

comment on table public.supplier_orders is 'Maps 1:1 to base44/entities/SupplierOrder.jsonc. paid_by_partner_id is a real FK to public.partners. No INSERT/UPDATE/DELETE RLS policy or GRANT in this phase — same reasoning as client_payments.';

-- =====================================================================
-- 4. protect_immutable_columns_partners trigger
--
-- Same pattern as customers/projects (see 0001_poc_core.sql section 6,
-- 0003_projects.sql section 3). partners is the only one of these 3
-- tables with UPDATE in this phase, so it's the only one that needs the
-- trigger right now — client_payments/supplier_orders have no UPDATE
-- path at all yet, so a trigger on them would be dead code (same "don't
-- build ahead of actual usage" principle applied to the RLS policies
-- below and to ProjectService's scope in Phase 2).
-- =====================================================================

create or replace function public.protect_immutable_columns_partners()
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
    raise exception 'deleted_at must be changed via a dedicated soft-delete RPC (not yet implemented for partners)';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger partners_protect_immutable
  before update on public.partners
  for each row execute function public.protect_immutable_columns_partners();

-- =====================================================================
-- 5. Enable RLS
-- =====================================================================

alter table public.partners enable row level security;
alter table public.client_payments enable row level security;
alter table public.supplier_orders enable row level security;

-- =====================================================================
-- 6. RLS policies — partners (full CRUD, reusing existing helper
-- functions from 0001_poc_core.sql)
-- =====================================================================

create policy partners_select on public.partners
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy partners_insert on public.partners
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy partners_update on public.partners
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

-- =====================================================================
-- 7. RLS policies — client_payments / supplier_orders (SELECT only)
-- =====================================================================

create policy client_payments_select on public.client_payments
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy supplier_orders_select on public.supplier_orders
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

-- No INSERT/UPDATE/DELETE policies for client_payments/supplier_orders —
-- deliberate, matches the read-only scope of this phase. Will be added
-- together with ProjectDetails.jsx's future migration (same principle
-- as projects' missing UPDATE policy in 0003_projects.sql section 5).

-- =====================================================================
-- 8. GRANT — included from the start (Phase 2 lesson)
-- =====================================================================

grant select, insert, update on public.partners to authenticated;
grant select on public.client_payments to authenticated;
grant select on public.supplier_orders to authenticated;

-- =====================================================================
-- End of 0005_partners_payments_orders.sql
-- =====================================================================
