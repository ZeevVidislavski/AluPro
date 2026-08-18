-- =====================================================================
-- 0010_agent_settings_alerts.sql
-- Phase 8: AgentSettings + AgentAlert — the "smart agent" business
-- alerting system behind BusinessAgent.jsx and MorningSummary.jsx.
--
-- No delete anywhere (no delete UI exists for either entity — alerts are
-- marked is_handled, not removed) — so no soft-delete RPC, no GUC bypass
-- flag on the immutable-columns trigger, same pattern as reminders in
-- 0007_reminders.sql.
--
-- AgentSettings is a de-facto singleton-per-tenant in application code
-- (BusinessAgent.jsx always reads settings[0]) — this migration adds a
-- unique partial index to enforce what the code already assumes, not a
-- behavior change.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. agent_settings
-- =====================================================================

create table public.agent_settings (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid not null references public.tenants(id) on delete cascade,

  minimum_profit_percent        numeric not null default 15,
  cash_flow_warning_threshold   numeric not null default -50000,
  max_open_projects             integer not null default 10,
  high_debt_threshold           numeric not null default 100000,
  contractor_priority_weight    numeric not null default 1.5,
  enable_morning_summary        boolean not null default true,
  enable_realtime_alerts        boolean not null default true,
  enable_smart_focus            boolean not null default true,
  max_focus_items               integer not null default 5,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create unique index agent_settings_one_active_per_tenant_idx
  on public.agent_settings (tenant_id) where deleted_at is null;

comment on table public.agent_settings is 'Maps 1:1 to base44/entities/AgentSettings.jsonc. One active row per tenant (enforced here; BusinessAgent.jsx already assumed this via settings[0]).';

-- =====================================================================
-- 2. agent_alerts
-- =====================================================================

create table public.agent_alerts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  alert_key       text not null,
  project_id      uuid references public.projects(id),
  project_name    text,
  alert_type      text not null check (alert_type in ('profitability','collection','cash_flow','workload','strategic')),
  severity        text not null check (severity in ('low','medium','high','critical')),
  message         text not null,
  details         text,
  is_handled      boolean not null default false,
  priority_score  numeric,
  action_type     text check (action_type in ('collect','follow_up','fix_profit','order_material','supplier_payment','general')),
  action_link     text,
  due_date        date,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index agent_alerts_tenant_id_idx on public.agent_alerts (tenant_id) where deleted_at is null;
create index agent_alerts_alert_key_idx on public.agent_alerts (tenant_id, alert_key) where deleted_at is null and is_handled = false;

comment on table public.agent_alerts is 'Maps 1:1 to base44/entities/AgentAlert.jsonc. project_id is nullable — the "workload" alert type is tenant-global, not tied to a project (alert_key = ''global|workload''). No delete — alerts are marked is_handled, never removed.';

-- =====================================================================
-- 3. protect_immutable_columns triggers — no soft-delete RPC exists for
-- either table, so deleted_at is blocked unconditionally (no GUC bypass
-- flag), same as reminders in 0007_reminders.sql.
-- =====================================================================

create or replace function public.protect_immutable_columns_agent_settings()
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
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted_at cannot be changed — no delete path exists for agent_settings';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger agent_settings_protect_immutable
  before update on public.agent_settings
  for each row execute function public.protect_immutable_columns_agent_settings();

create or replace function public.protect_immutable_columns_agent_alerts()
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
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted_at cannot be changed — no delete path exists for agent_alerts';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger agent_alerts_protect_immutable
  before update on public.agent_alerts
  for each row execute function public.protect_immutable_columns_agent_alerts();

-- =====================================================================
-- 4. Enable RLS + policies (select/insert/update — no delete policy,
-- no RPC, matching section 0 above)
-- =====================================================================

alter table public.agent_settings enable row level security;
alter table public.agent_alerts enable row level security;

create policy agent_settings_select on public.agent_settings
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy agent_settings_insert on public.agent_settings
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy agent_settings_update on public.agent_settings
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

create policy agent_alerts_select on public.agent_alerts
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy agent_alerts_insert on public.agent_alerts
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and (
      project_id is null
      or project_id in (
        select id from public.projects
        where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
      )
    )
  );

create policy agent_alerts_update on public.agent_alerts
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
-- 5. GRANT — included from the start (Phase 2 lesson)
-- =====================================================================

grant select, insert, update on public.agent_settings to authenticated;
grant select, insert, update on public.agent_alerts to authenticated;

-- =====================================================================
-- End of 0010_agent_settings_alerts.sql
-- =====================================================================
