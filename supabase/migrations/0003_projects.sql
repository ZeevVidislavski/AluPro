-- =====================================================================
-- 0003_projects.sql
-- Phase 2: Project (list + create only — ProjectDetails.jsx stays on
-- Base44 for now, see docs/PHASE_2_IMPLEMENTATION_PLAN.md section 0).
--
-- Source of truth: docs/PHASE_2_IMPLEMENTATION_PLAN.md (approved
-- 2026-08-12) + docs/SUPABASE_SCHEMA_PLAN.md section "עדכון — projects".
--
-- Lesson applied from Phase 1 (see PHASE_1_IMPLEMENTATION_PLAN.md section
-- 6): GRANT statements are included in THIS migration, not left for a
-- separate follow-up fix. 0001_poc_core.sql originally omitted them and
-- every request failed with "permission denied" (Postgres 42501) until
-- 0002_grants_fix.sql patched it after the fact — do not repeat that.
--
-- This file has not been run against any Supabase project. Review it
-- (and ideally a local `supabase db reset`) before applying.
-- =====================================================================

-- =====================================================================
-- 1. project_number sequence — fixes the known Base44 bug where
-- project_number was generated client-side as
-- `P${Date.now().toString().slice(-6)}` (src/pages/Projects.jsx, no
-- uniqueness guarantee — see AUDIT_REPORT_2026-08-03.md and
-- CLAUDE_MIGRATION_REVIEW.md section 9). Per the approved decision
-- (PHASE_2_IMPLEMENTATION_PLAN.md section 5, option B): a real Postgres
-- sequence guarantees atomicity and uniqueness. One sequence per
-- deployment (not per-tenant) is sufficient for this PoC — a per-tenant
-- numbering scheme would need a composite key and is out of scope here;
-- flagged as a possible future refinement, not a defect.
-- =====================================================================

create sequence public.project_number_seq start 1;

-- =====================================================================
-- 2. projects
-- =====================================================================

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  project_number  text not null default ('P' || lpad(nextval('public.project_number_seq')::text, 6, '0')),
  name            text not null,
  customer_id     uuid not null references public.customers(id),
  customer_name   text not null,
  address         text,
  aluminum_color  text,
  start_date      date,
  target_date     date,
  status          text not null default 'quote' check (status in (
                    'quote', 'negotiation', 'approved', 'ordering',
                    'production', 'installation', 'completed', 'invoiced'
                  )),
  initial_quote      numeric(12,2),
  final_quote        numeric(12,2),
  notes              text,
  settlement_status  text not null default 'open' check (settlement_status in ('open', 'closed')),
  closed_at          date,
  closed_by          uuid references public.profiles(id),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id),
  deleted_at     timestamptz
);

create unique index projects_project_number_unique on public.projects (project_number) where deleted_at is null;
create index projects_tenant_id_idx on public.projects (tenant_id) where deleted_at is null;
create index projects_customer_id_idx on public.projects (customer_id) where deleted_at is null;

comment on table public.projects is 'Maps 1:1 to base44/entities/Project.jsonc fields. Unlike Base44, customer_id is a real FK to public.customers (not a loose string) — customer_name stays denormalized on purpose, matching the existing snapshot-style pattern already used elsewhere (e.g. QuoteItemComponent.name_snapshot). closed_by is a real FK to profiles, ready for when ProjectDetails.jsx migrates and stops hardcoding "מנהל" (see AUDIT_REPORT_2026-08-03.md section 14.2). settlement_status/closed_at/closed_by are not reachable from Projects.jsx (list+create only) but are defined now so ProjectDetails.jsx''s future migration needs no further ALTER TABLE.';

-- =====================================================================
-- 3. protect_immutable_columns_projects trigger
--
-- Same pattern as customers (see 0001_poc_core.sql section 6): prevents
-- created_by/tenant_id from ever changing, and requires deleted_at
-- changes to go through a dedicated RPC rather than a generic UPDATE.
-- Even though Projects.jsx doesn't expose update/delete UI yet, this
-- trigger is defined now so ProjectDetails.jsx's future migration
-- inherits it for free instead of needing a new migration to add it.
--
-- Reuses the SAME session-local GUC flag (app.allow_deleted_at_change)
-- as customers' soft_delete_customer/restore_customer RPCs use — no
-- soft-delete RPC exists yet for projects (out of scope for this PoC,
-- since Projects.jsx has no delete UI), but the flag name is shared
-- deliberately so a future projects RPC can reuse the same convention
-- without inventing a new GUC name.
-- =====================================================================

create or replace function public.protect_immutable_columns_projects()
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
    raise exception 'deleted_at must be changed via a dedicated soft-delete RPC (not yet implemented for projects)';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger projects_protect_immutable
  before update on public.projects
  for each row execute function public.protect_immutable_columns_projects();

-- =====================================================================
-- 4. Enable RLS
-- =====================================================================

alter table public.projects enable row level security;

-- =====================================================================
-- 5. RLS policies — projects
--
-- Same tenant-isolation pattern as customers, reusing the existing
-- SECURITY DEFINER helper functions from 0001_poc_core.sql
-- (user_tenant_ids/user_tenant_role) — no new helper functions needed.
-- =====================================================================

create policy projects_select on public.projects
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy projects_insert on public.projects
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    -- customer_id must belong to the SAME tenant as the project being
    -- created — otherwise a user could reference another tenant's
    -- customer by UUID even though RLS on `customers` would hide it from
    -- them in a normal SELECT. This check closes that gap explicitly.
    and customer_id in (
      select id from public.customers
      where tenant_id in (select public.user_tenant_ids())
        and deleted_at is null
    )
  );

-- No UPDATE/DELETE policy yet — Projects.jsx has no edit/delete UI in
-- this phase (see PHASE_2_IMPLEMENTATION_PLAN.md section 0). Adding an
-- UPDATE policy now, before ProjectDetails.jsx is planned in detail,
-- risks repeating the Phase 1 mistake of designing RLS around assumed
-- usage rather than actual code (see SUPABASE_SCHEMA_PLAN.md section 7
-- for the customers_update/soft-delete overlap bug that came from
-- exactly that). It will be added when ProjectDetails.jsx's migration is
-- planned.

-- =====================================================================
-- 6. GRANT — included from the start, per the Phase 1 lesson (see file
-- header). Note SELECT-only on the sequence: nextval() is called inside
-- the table's own DEFAULT expression during INSERT, which runs with the
-- privileges of the table owner (not the connecting role), so
-- authenticated does NOT need USAGE on the sequence directly.
-- =====================================================================

grant select on public.projects to authenticated;
grant insert on public.projects to authenticated;
-- No UPDATE grant yet — matches "no UPDATE policy" above. Add together
-- when ProjectDetails.jsx migrates, not before (another Phase 1 lesson:
-- an UPDATE grant with no matching RLS policy is harmless but pointless
-- clutter, and forgetting to add the policy later while the grant sits
-- unused is a worse trap than not granting until both are ready).

-- =====================================================================
-- End of 0003_projects.sql
-- =====================================================================
