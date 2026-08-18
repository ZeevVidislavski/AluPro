-- =====================================================================
-- 0013_quote_editor.sql
-- Phase 11: QuoteEditor.jsx — the two genuinely new entities it needs,
-- QuoteItem and QuoteItemComponent. Every other entity QuoteEditor.jsx
-- touches (ModelPricing, QuoteTemplate, QuoteTemplateComponent,
-- CompanyHeader, Project, ProjectQuote) already exists in Supabase from
-- earlier phases — this migration only adds what's missing.
--
-- Depends on 0012_project_details.sql having run first (project_quotes
-- needs its INSERT/UPDATE policies from that migration for
-- QuoteEditor.jsx's handleSave to work end-to-end) — but quote_items
-- itself only needs project_quotes to EXIST as a table, which it already
-- does since Phase 4/0006. Run 0012 before this file regardless, to keep
-- the two phases' rollout order matching their written order.
--
-- Soft delete via RPC — same pattern as every other deletable table in
-- this project. This intentionally diverges from Base44's original hard
-- delete for QuoteItem/QuoteItemComponent (see
-- docs/PHASE_11_IMPLEMENTATION_PLAN.md section 2.3) for consistency;
-- decided under Auto Mode without user confirmation — flag for review.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. quote_items
-- =====================================================================

create table public.quote_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  quote_id     uuid not null references public.project_quotes(id),

  width_cm     numeric,
  height_cm    numeric,
  quantity     numeric not null default 1,
  description  text,
  total_price  numeric,
  sort_order   numeric,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index quote_items_tenant_id_idx on public.quote_items (tenant_id) where deleted_at is null;
create index quote_items_quote_id_idx on public.quote_items (quote_id) where deleted_at is null;

comment on table public.quote_items is 'Maps 1:1 to base44/entities/QuoteItem.jsonc. Full CRUD via QuoteEditor.jsx. Base44 hard-deletes these; here they are soft-deleted via RPC for consistency with the rest of this project (see PHASE_11_IMPLEMENTATION_PLAN.md section 2.3/5).';

-- =====================================================================
-- 2. quote_item_components
-- =====================================================================

create table public.quote_item_components (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  quote_item_id            uuid not null references public.quote_items(id),
  catalog_item_id          uuid references public.model_pricing(id),

  name_snapshot            text not null,
  category_snapshot        text,
  pricing_method_snapshot  text not null check (pricing_method_snapshot in ('sqm','meter','unit')),
  price_snapshot           numeric not null,
  quantity                 numeric,
  calculated_value         numeric,
  sort_order               numeric,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index quote_item_components_tenant_id_idx on public.quote_item_components (tenant_id) where deleted_at is null;
create index quote_item_components_quote_item_id_idx on public.quote_item_components (quote_item_id) where deleted_at is null;

comment on table public.quote_item_components is 'Maps 1:1 to base44/entities/QuoteItemComponent.jsonc. Same snapshot pattern as quote_template_components (Phase 7) — pricing_method_snapshot intentionally uses a different enum (sqm/meter/unit) than model_pricing.pricing_method (sqm/meter_width/meter_height/unit), matching the same pre-existing Base44 inconsistency documented in PHASE_7_IMPLEMENTATION_PLAN.md section 1.5. catalog_item_id is nullable (snapshot, source row may later be deleted).';

-- =====================================================================
-- 3. protect_immutable_columns triggers + soft-delete RPCs
-- =====================================================================

create or replace function public.protect_immutable_columns_quote_items()
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
    raise exception 'deleted_at must be changed via soft_delete_quote_item()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger quote_items_protect_immutable
  before update on public.quote_items
  for each row execute function public.protect_immutable_columns_quote_items();

create or replace function public.soft_delete_quote_item(item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.quote_items where id = item_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Quote item not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this quote item';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.quote_items set deleted_at = now(), updated_by = auth.uid() where id = item_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create or replace function public.protect_immutable_columns_quote_item_components()
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
    raise exception 'deleted_at must be changed via soft_delete_quote_item_component()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger quote_item_components_protect_immutable
  before update on public.quote_item_components
  for each row execute function public.protect_immutable_columns_quote_item_components();

create or replace function public.soft_delete_quote_item_component(component_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.quote_item_components where id = component_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Quote item component not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this quote item component';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.quote_item_components set deleted_at = now(), updated_by = auth.uid() where id = component_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

-- =====================================================================
-- 4. Enable RLS + policies
-- =====================================================================

alter table public.quote_items enable row level security;
alter table public.quote_item_components enable row level security;

create policy quote_items_select on public.quote_items
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy quote_items_insert on public.quote_items
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and quote_id in (
      select id from public.project_quotes
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy quote_items_update on public.quote_items
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

create policy quote_item_components_select on public.quote_item_components
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy quote_item_components_insert on public.quote_item_components
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and quote_item_id in (
      select id from public.quote_items
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy quote_item_components_update on public.quote_item_components
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

grant select, insert, update on public.quote_items to authenticated;
grant select, insert, update on public.quote_item_components to authenticated;
grant execute on function public.soft_delete_quote_item(uuid) to authenticated;
grant execute on function public.soft_delete_quote_item_component(uuid) to authenticated;

-- =====================================================================
-- 6. project.get() support — projects table already has everything
-- needed for a single-row SELECT by id; no schema change required, this
-- section exists only as a note that ProjectService.get(id) (needed by
-- both Phase 10 and Phase 11) requires no migration, just a new Service
-- method against the existing projects_select policy.
-- =====================================================================

-- =====================================================================
-- End of 0013_quote_editor.sql
-- =====================================================================
