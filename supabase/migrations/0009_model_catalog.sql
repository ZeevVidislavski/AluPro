-- =====================================================================
-- 0009_model_catalog.sql
-- Phase 7: ModelPricing, ModelComponent, QuoteTemplate,
-- QuoteTemplateComponent — full CRUD for all four (list/create/update/
-- delete-soft), backing the ModelPricing.jsx catalog+templates screen.
--
-- QuoteEditor.jsx keeps reading ModelPricing/QuoteTemplate/
-- QuoteTemplateComponent from Base44 (out of scope, same as every prior
-- phase) — see docs/PHASE_7_IMPLEMENTATION_PLAN.md section 0 for the
-- resulting gap (records created here won't appear there yet).
--
-- pricing_method_snapshot on quote_template_components intentionally
-- keeps a DIFFERENT enum (sqm/meter/unit) than model_pricing.
-- pricing_method (sqm/meter_width/meter_height/unit) — this mismatch
-- already exists in Base44 and is preserved as-is, not "fixed" here (see
-- PHASE_7_IMPLEMENTATION_PLAN.md section 1.5).
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. model_pricing
-- =====================================================================

create table public.model_pricing (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,

  model_name     text not null,
  category       text not null default 'product'
                   check (category in ('product','series','structure','shutter','motor','mesh','addon','glass','other')),
  pricing_method text not null default 'sqm'
                   check (pricing_method in ('sqm','meter_width','meter_height','unit')),
  base_price     numeric not null,
  notes          text,
  is_active      boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index model_pricing_tenant_id_idx on public.model_pricing (tenant_id) where deleted_at is null;

comment on table public.model_pricing is 'Maps 1:1 to base44/entities/ModelPricing.jsonc. Full CRUD via ModelPricing.jsx catalog tab.';

-- =====================================================================
-- 2. model_components
-- =====================================================================

create table public.model_components (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  model_id           uuid not null references public.model_pricing(id),

  component_type     text not null check (component_type in ('profile','glass','hardware','accessory')),
  item_code          text not null,
  quantity           numeric not null default 1,
  length_base        text check (length_base in ('opening_width','opening_height','fixed')),
  length_op1         text not null default 'none' check (length_op1 in ('none','add','subtract','multiply','divide')),
  length_val1        numeric,
  length_op2         text not null default 'none' check (length_op2 in ('none','add','subtract','multiply','divide')),
  length_val2        numeric,
  width_base         text check (width_base in ('opening_width','opening_height','fixed')),
  width_op1          text not null default 'none' check (width_op1 in ('none','add','subtract','multiply','divide')),
  width_val1         numeric,
  width_op2          text not null default 'none' check (width_op2 in ('none','add','subtract','multiply','divide')),
  width_val2         numeric,
  calculated_length  numeric,
  calculated_width   numeric,
  notes              text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index model_components_tenant_id_idx on public.model_components (tenant_id) where deleted_at is null;
create index model_components_model_id_idx on public.model_components (model_id) where deleted_at is null;

comment on table public.model_components is 'Maps 1:1 to base44/entities/ModelComponent.jsonc. Full CRUD via ModelPricing.jsx > ModelComponentsTab.jsx (the "manufacturing recipe" for a model_pricing row).';

-- =====================================================================
-- 3. quote_templates
-- =====================================================================

create table public.quote_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,

  name         text not null,
  description  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index quote_templates_tenant_id_idx on public.quote_templates (tenant_id) where deleted_at is null;

comment on table public.quote_templates is 'Maps 1:1 to base44/entities/QuoteTemplate.jsonc. Full CRUD via ModelPricing.jsx templates tab.';

-- =====================================================================
-- 4. quote_template_components
-- =====================================================================

create table public.quote_template_components (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  template_id               uuid not null references public.quote_templates(id),
  catalog_item_id           uuid references public.model_pricing(id),  -- nullable: this is a snapshot, the source row may later be deleted

  name_snapshot             text not null,
  category_snapshot         text,
  pricing_method_snapshot   text not null check (pricing_method_snapshot in ('sqm','meter','unit')),
  price_snapshot            numeric not null,
  sort_order                numeric,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index quote_template_components_tenant_id_idx on public.quote_template_components (tenant_id) where deleted_at is null;
create index quote_template_components_template_id_idx on public.quote_template_components (template_id) where deleted_at is null;

comment on table public.quote_template_components is 'Maps 1:1 to base44/entities/QuoteTemplateComponent.jsonc. Full CRUD via TemplateComponentsManager.jsx. price_snapshot/name_snapshot/pricing_method_snapshot are frozen at insert time, not a live join to model_pricing.';

-- =====================================================================
-- 5. protect_immutable_columns triggers (one per table, same pattern as
-- customers/project_quotes/company_headers) + soft-delete RPCs
-- =====================================================================

create or replace function public.protect_immutable_columns_model_pricing()
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
    raise exception 'deleted_at must be changed via soft_delete_model_pricing()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger model_pricing_protect_immutable
  before update on public.model_pricing
  for each row execute function public.protect_immutable_columns_model_pricing();

create or replace function public.soft_delete_model_pricing(model_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.model_pricing where id = model_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Model not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this model';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.model_pricing set deleted_at = now(), updated_by = auth.uid() where id = model_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create or replace function public.protect_immutable_columns_model_components()
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
    raise exception 'deleted_at must be changed via soft_delete_model_component()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger model_components_protect_immutable
  before update on public.model_components
  for each row execute function public.protect_immutable_columns_model_components();

create or replace function public.soft_delete_model_component(component_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.model_components where id = component_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Component not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this component';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.model_components set deleted_at = now(), updated_by = auth.uid() where id = component_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create or replace function public.protect_immutable_columns_quote_templates()
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
    raise exception 'deleted_at must be changed via soft_delete_quote_template()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger quote_templates_protect_immutable
  before update on public.quote_templates
  for each row execute function public.protect_immutable_columns_quote_templates();

create or replace function public.soft_delete_quote_template(template_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.quote_templates where id = template_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Template not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this template';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.quote_templates set deleted_at = now(), updated_by = auth.uid() where id = template_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create or replace function public.protect_immutable_columns_quote_template_components()
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
    raise exception 'deleted_at must be changed via soft_delete_quote_template_component()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger quote_template_components_protect_immutable
  before update on public.quote_template_components
  for each row execute function public.protect_immutable_columns_quote_template_components();

create or replace function public.soft_delete_quote_template_component(component_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.quote_template_components where id = component_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Template component not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this template component';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.quote_template_components set deleted_at = now(), updated_by = auth.uid() where id = component_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

-- No restore RPCs — no restore UI exists for any of the 4 tables, same
-- "don't build ahead of actual usage" principle as every prior phase.

-- =====================================================================
-- 6. Enable RLS + policies (select/insert/update, delete via RPC only)
-- =====================================================================

alter table public.model_pricing enable row level security;
alter table public.model_components enable row level security;
alter table public.quote_templates enable row level security;
alter table public.quote_template_components enable row level security;

create policy model_pricing_select on public.model_pricing
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy model_pricing_insert on public.model_pricing
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy model_pricing_update on public.model_pricing
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

create policy model_components_select on public.model_components
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy model_components_insert on public.model_components
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and model_id in (
      select id from public.model_pricing
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy model_components_update on public.model_components
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

create policy quote_templates_select on public.quote_templates
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy quote_templates_insert on public.quote_templates
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy quote_templates_update on public.quote_templates
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

create policy quote_template_components_select on public.quote_template_components
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy quote_template_components_insert on public.quote_template_components
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and template_id in (
      select id from public.quote_templates
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy quote_template_components_update on public.quote_template_components
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
-- 7. GRANT — included from the start (Phase 2 lesson)
-- =====================================================================

grant select, insert, update on public.model_pricing to authenticated;
grant select, insert, update on public.model_components to authenticated;
grant select, insert, update on public.quote_templates to authenticated;
grant select, insert, update on public.quote_template_components to authenticated;

grant execute on function public.soft_delete_model_pricing(uuid) to authenticated;
grant execute on function public.soft_delete_model_component(uuid) to authenticated;
grant execute on function public.soft_delete_quote_template(uuid) to authenticated;
grant execute on function public.soft_delete_quote_template_component(uuid) to authenticated;

-- =====================================================================
-- End of 0009_model_catalog.sql
-- =====================================================================
