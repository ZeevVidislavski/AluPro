-- =====================================================================
-- 0015_material_orders.sql
-- MaterialOrder + MaterialOrderItem — the last piece of
-- ProjectDetails.jsx's "הזמנות חומר" tab, deferred in Phase 10 because
-- materialOrderGenerator.js depends on QuoteItem/QuoteItemComponent,
-- which only became available in Phase 11 (0013_quote_editor.sql). Now
-- that both exist, this closes the gap.
--
-- Soft delete via RPC — same consistency choice as quote_items/
-- quote_item_components (Phase 11): Base44's original UI hard-deletes
-- (both the "regenerate" flow and the manual delete button), but this
-- project soft-deletes everywhere else with a delete path.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. material_orders
-- =====================================================================

create table public.material_orders (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  project_id    uuid not null references public.projects(id),
  project_name  text,

  order_type  text not null check (order_type in ('profiles','hardware','glass')),
  status      text not null default 'draft' check (status in ('draft','sent','received')),
  notes       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index material_orders_tenant_id_idx on public.material_orders (tenant_id) where deleted_at is null;
create index material_orders_project_id_idx on public.material_orders (project_id) where deleted_at is null;

comment on table public.material_orders is 'Maps 1:1 to base44/entities/MaterialOrder.jsonc. Generated in bulk by materialOrderGenerator.js from a project''s QuoteItem/QuoteItemComponent/ModelComponent data, or managed manually via MaterialOrdersTab.jsx (status changes, delete).';

-- =====================================================================
-- 2. material_order_items
-- =====================================================================

create table public.material_order_items (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  material_order_id  uuid not null references public.material_orders(id),

  item_code      text not null,
  total_quantity numeric not null,
  total_length   numeric,
  notes          text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index material_order_items_tenant_id_idx on public.material_order_items (tenant_id) where deleted_at is null;
create index material_order_items_order_id_idx on public.material_order_items (material_order_id) where deleted_at is null;

comment on table public.material_order_items is 'Maps 1:1 to base44/entities/MaterialOrderItem.jsonc. Aggregated line items (by item_code) for one material_orders row.';

-- =====================================================================
-- 3. protect_immutable_columns triggers + soft-delete RPCs
-- =====================================================================

create or replace function public.protect_immutable_columns_material_orders()
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
    raise exception 'deleted_at must be changed via soft_delete_material_order()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger material_orders_protect_immutable
  before update on public.material_orders
  for each row execute function public.protect_immutable_columns_material_orders();

create or replace function public.soft_delete_material_order(order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.material_orders where id = order_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Material order not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this material order';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.material_orders set deleted_at = now(), updated_by = auth.uid() where id = order_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create or replace function public.protect_immutable_columns_material_order_items()
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
    raise exception 'deleted_at must be changed via soft_delete_material_order_item()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger material_order_items_protect_immutable
  before update on public.material_order_items
  for each row execute function public.protect_immutable_columns_material_order_items();

create or replace function public.soft_delete_material_order_item(item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.material_order_items where id = item_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Material order item not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this material order item';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.material_order_items set deleted_at = now(), updated_by = auth.uid() where id = item_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

-- =====================================================================
-- 4. Enable RLS + policies
-- =====================================================================

alter table public.material_orders enable row level security;
alter table public.material_order_items enable row level security;

create policy material_orders_select on public.material_orders
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy material_orders_insert on public.material_orders
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and project_id in (
      select id from public.projects
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy material_orders_update on public.material_orders
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

create policy material_order_items_select on public.material_order_items
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy material_order_items_insert on public.material_order_items
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and material_order_id in (
      select id from public.material_orders
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy material_order_items_update on public.material_order_items
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
-- 5. GRANT
-- =====================================================================

grant select, insert, update on public.material_orders to authenticated;
grant select, insert, update on public.material_order_items to authenticated;
grant execute on function public.soft_delete_material_order(uuid) to authenticated;
grant execute on function public.soft_delete_material_order_item(uuid) to authenticated;

-- =====================================================================
-- End of 0015_material_orders.sql
-- =====================================================================
