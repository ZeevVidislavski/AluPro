-- =====================================================================
-- 0026_suppliers.sql
-- A per-company suppliers table (name, contact person, phone, e-mail) so
-- the "new order" form can pick a supplier from a list instead of typing
-- free text. supplier_orders keeps its supplier_name snapshot and gains an
-- optional supplier_id link. Pattern follows 0005 (partners) / 0011
-- (soft_delete_partner).
-- =====================================================================

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  name          text not null,
  contact_name  text,
  phone         text,
  email         text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index suppliers_tenant_id_idx on public.suppliers (tenant_id) where deleted_at is null;

alter table public.supplier_orders
  add column supplier_id uuid references public.suppliers(id);

-- ---- immutable columns + soft-delete guard ----
create or replace function public.protect_immutable_columns_suppliers()
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
    raise exception 'deleted_at must be changed via soft_delete_supplier()';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger suppliers_protect_immutable
  before update on public.suppliers
  for each row execute function public.protect_immutable_columns_suppliers();

-- ---- RLS ----
alter table public.suppliers enable row level security;

create policy suppliers_select on public.suppliers
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy suppliers_insert on public.suppliers
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy suppliers_update on public.suppliers
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

-- ---- soft delete RPC ----
create or replace function public.soft_delete_supplier(supplier_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.suppliers where id = supplier_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Supplier not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this supplier';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.suppliers set deleted_at = now(), updated_by = auth.uid() where id = supplier_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update, delete on public.suppliers to service_role;
grant execute on function public.soft_delete_supplier(uuid) to authenticated;
