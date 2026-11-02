-- =====================================================================
-- 0022_platform_copy_models.sql
-- Super-admin console: let a platform admin pick models from one tenant's
-- catalog and copy them (with their component recipes) into another
-- tenant — the "הוסף דגמים" button on the tenant list/detail screens.
--
-- Same approach as every other platform_* function (0017/0019): SECURITY
-- DEFINER + a mandatory is_platform_admin() self-check, NOT a loosened
-- RLS policy on model_pricing/model_components (see 0018 header point 4 —
-- bypasses are added only for a concrete console screen, and only as
-- narrowly as that screen needs). Copying, not linking, matches the
-- existing design (0012 seed: each tenant owns and edits its own copy).
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. platform_list_tenant_models — read any tenant's model catalog.
-- ---------------------------------------------------------------------

create or replace function public.platform_list_tenant_models(p_tenant_id uuid)
returns table (
  id             uuid,
  model_name     text,
  category       text,
  pricing_method text,
  base_price     numeric,
  notes          text,
  is_active      boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.model_name, m.category, m.pricing_method, m.base_price, m.notes, m.is_active
  from public.model_pricing m
  where m.tenant_id = p_tenant_id
    and m.deleted_at is null
    and public.is_platform_admin()
  order by m.category, m.model_name;
$$;

grant execute on function public.platform_list_tenant_models(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. platform_copy_models_to_tenant — copies the chosen models (and their
--    live components) from p_source_tenant_id into p_target_tenant_id.
--    Models whose name already exists in the target are skipped, so
--    running it twice never duplicates. Returns the number copied.
-- ---------------------------------------------------------------------

create or replace function public.platform_copy_models_to_tenant(
  p_source_tenant_id uuid,
  p_target_tenant_id uuid,
  p_model_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_src public.model_pricing%rowtype;
  v_new_id uuid;
  v_count integer := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'Insufficient permissions: platform admin only';
  end if;
  if p_source_tenant_id = p_target_tenant_id then
    raise exception 'Source and target tenant must differ';
  end if;
  if not exists (select 1 from public.tenants where id = p_target_tenant_id) then
    raise exception 'Target tenant not found';
  end if;

  for v_src in
    select * from public.model_pricing
    where tenant_id = p_source_tenant_id
      and id = any(p_model_ids)
      and deleted_at is null
      and not exists (
        select 1 from public.model_pricing t
        where t.tenant_id = p_target_tenant_id
          and t.deleted_at is null
          and t.model_name = model_pricing.model_name
      )
  loop
    insert into public.model_pricing
      (tenant_id, model_name, category, pricing_method, base_price, notes, is_active, created_by)
    values
      (p_target_tenant_id, v_src.model_name, v_src.category, v_src.pricing_method,
       v_src.base_price, v_src.notes, v_src.is_active, auth.uid())
    returning id into v_new_id;

    insert into public.model_components
      (tenant_id, model_id, component_type, item_code, quantity,
       length_base, length_op1, length_val1, length_op2, length_val2,
       width_base, width_op1, width_val1, width_op2, width_val2,
       calculated_length, calculated_width, notes, created_by)
    select
      p_target_tenant_id, v_new_id, c.component_type, c.item_code, c.quantity,
      c.length_base, c.length_op1, c.length_val1, c.length_op2, c.length_val2,
      c.width_base, c.width_op1, c.width_val1, c.width_op2, c.width_val2,
      c.calculated_length, c.calculated_width, c.notes, auth.uid()
    from public.model_components c
    where c.model_id = v_src.id and c.deleted_at is null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.platform_copy_models_to_tenant(uuid, uuid, uuid[]) to authenticated;

-- =====================================================================
-- End of 0022_platform_copy_models.sql
-- =====================================================================
