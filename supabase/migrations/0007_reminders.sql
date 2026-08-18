-- =====================================================================
-- 0007_reminders.sql
-- Phase 5: Reminder — list + create + update (no delete UI exists, no
-- soft-delete RPC needed). Document is NOT included — it has no
-- dedicated screen, only exists inside ProjectDetails.jsx, which hasn't
-- migrated. See docs/PHASE_5_IMPLEMENTATION_PLAN.md.
--
-- Unlike project_quotes (Phase 4), Reminder has no cross-system UUID
-- navigation problem — project_id is nullable and there's no
-- Base44-only follow-up screen depending on the same id. create() is
-- included in this phase's scope for that reason.
--
-- Lessons applied from Phase 1-4: GRANT included from the start (all
-- objects, not just tables); immutable-column trigger without a bypass
-- flag (no soft-delete RPC exists here, so no flag is needed — simpler
-- than customers/project_quotes).
--
-- This file has not been run against any Supabase project. Review it
-- (and ideally a local `supabase db reset`) before applying.
-- =====================================================================

-- =====================================================================
-- 1. reminders
-- =====================================================================

create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  project_id    uuid references public.projects(id),  -- nullable — unlike projects/client_payments/project_quotes
  project_name  text,
  title         text not null,
  description   text,
  due_date      date not null,
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status        text not null default 'open' check (status in ('open', 'done', 'postponed')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index reminders_tenant_id_idx on public.reminders (tenant_id) where deleted_at is null;
create index reminders_project_id_idx on public.reminders (project_id) where deleted_at is null;

comment on table public.reminders is 'Maps 1:1 to base44/entities/Reminder.jsonc. project_id is nullable — required: [title, due_date, priority] only, matching the original schema (unlike Document.project_id, which is required there). No delete UI exists for reminders (Reminders.jsx only changes status via a Select), so no soft-delete RPC or DELETE policy/grant in this phase.';

-- =====================================================================
-- 2. protect_immutable_columns_reminders trigger
--
-- Simpler than customers/project_quotes: no soft-delete RPC exists for
-- reminders, so there's no bypass GUC flag needed — deleted_at simply
-- can never change via UPDATE, full stop, until a delete feature is
-- actually built.
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

  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted_at cannot be changed — no delete feature exists for reminders yet';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger reminders_protect_immutable
  before update on public.reminders
  for each row execute function public.protect_immutable_columns_reminders();

-- =====================================================================
-- 3. Enable RLS
-- =====================================================================

alter table public.reminders enable row level security;

-- =====================================================================
-- 4. RLS policies
-- =====================================================================

create policy reminders_select on public.reminders
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy reminders_insert on public.reminders
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    -- project_id is nullable here (unlike projects/client_payments) — a
    -- reminder with no project is valid, so the FK check only applies
    -- when project_id IS NOT NULL.
    and (
      project_id is null
      or project_id in (
        select id from public.projects
        where tenant_id in (select public.user_tenant_ids())
          and deleted_at is null
      )
    )
  );

-- Single UPDATE policy (no overlapping policies — Phase 1 lesson).
-- deleted_at is not reachable through this policy in practice (blocked
-- unconditionally by the trigger above, since no soft-delete RPC exists
-- to need a bypass).
create policy reminders_update on public.reminders
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

grant select, insert, update on public.reminders to authenticated;

-- =====================================================================
-- End of 0007_reminders.sql
-- =====================================================================
