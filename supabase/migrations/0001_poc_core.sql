-- =====================================================================
-- 0001_poc_core.sql
-- Phase 1 Proof of Concept: Tenant -> User -> Membership -> Customer
--
-- Source of truth: docs/SUPABASE_SCHEMA_PLAN.md (as approved 2026-08-03,
-- including the second round of security fixes: RLS recursion prevention,
-- RPC-based soft delete/restore, full profiles RLS, tenants/memberships
-- management policies, explicit search_path, WITH CHECK on every UPDATE,
-- and immutable-column protection).
--
-- Scope: ONLY the 4 tables needed for the Customers PoC. The other 19
-- Base44 entities are explicitly out of scope (see CLAUDE_MIGRATION_REVIEW.md
-- section 8 for their planned order).
--
-- This file has not been run against any Supabase project. Review it
-- against a real project (and ideally a local `supabase db reset`) before
-- applying to anything that matters.
-- =====================================================================

-- =====================================================================
-- 1. tenants
-- =====================================================================

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  status      text not null default 'active' check (status in ('active', 'suspended', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index tenants_slug_unique on public.tenants (slug) where deleted_at is null;

comment on table public.tenants is 'Phase 1 PoC: one row per company. Multi-tenant is a confirmed target (ADR-03), not speculative.';

-- =====================================================================
-- 2. profiles (extends auth.users — 1:1)
-- =====================================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Business-facing user record. id = auth.uid(). No deleted_at: profile deletion is tied to auth.users deletion, managed by Supabase Auth itself.';

-- =====================================================================
-- 3. tenant_memberships
-- =====================================================================

create table public.tenant_memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  unique (tenant_id, profile_id)
);

comment on table public.tenant_memberships is 'Many-to-many link between profiles and tenants, with a role. "Active tenant" resolution strategy: single-membership assumption for PoC (see SUPABASE_SCHEMA_PLAN.md section 4) — RLS policies here deliberately use "tenant_id IN (...)" rather than "= (... LIMIT 1)" so a future move to multi-membership needs no schema change.';

-- =====================================================================
-- 4. customers
-- =====================================================================

create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,

  name           text not null,
  customer_type  text not null check (customer_type in ('private', 'contractor')),
  phone          text not null,
  email          text,
  address        text,
  notes          text,
  status         text not null default 'active' check (status in ('active', 'inactive')),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id),
  deleted_at     timestamptz
);

create index customers_tenant_id_idx on public.customers (tenant_id) where deleted_at is null;

comment on table public.customers is 'Maps 1:1 to base44/entities/Customer.jsonc fields (name/customer_type/phone required, matching the original Base44 schema). customer_type and status are CHECK constraints here instead of Base44''s loose enum.';

-- =====================================================================
-- 5. Helper functions (SECURITY DEFINER) — prevent RLS self-referencing
--    recursion on tenant_memberships. See SUPABASE_SCHEMA_PLAN.md 6.6.
-- =====================================================================

create or replace function public.user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from public.tenant_memberships
  where profile_id = auth.uid() and deleted_at is null;
$$;

create or replace function public.user_tenant_role(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.tenant_memberships
  where profile_id = auth.uid() and tenant_id = p_tenant_id and deleted_at is null
  limit 1;
$$;

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = p_tenant_id
      and role in ('owner', 'admin')
      and deleted_at is null
  );
$$;

-- =====================================================================
-- 6. protect_immutable_columns trigger
--
-- Enforces (at the DB level, not just RLS) that created_by/tenant_id can
-- never change after insert, and that deleted_at can only be changed via
-- the soft_delete_customer()/restore_customer() RPCs below — NOT via a
-- generic UPDATE from the client (see SUPABASE_SCHEMA_PLAN.md 6.3 and 8).
--
-- IMPORTANT (fix applied while assembling this migration, not present in
-- the original doc's trigger body): the RPC functions themselves need to
-- perform `UPDATE customers SET deleted_at = ...` — if this trigger
-- rejected every deleted_at change unconditionally, it would also block
-- its own authorized RPCs. A session-local GUC flag
-- (app.allow_deleted_at_change) is set by the RPCs immediately before
-- their UPDATE and reset after, so the trigger only rejects deleted_at
-- changes that do NOT originate from soft_delete_customer/restore_customer.
-- This was not verified against a live Supabase instance — flagged
-- explicitly in SUPABASE_SCHEMA_PLAN.md as needing confirmation during
-- actual implementation.
-- =====================================================================

create or replace function public.protect_immutable_columns()
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
    raise exception 'deleted_at must be changed via soft_delete_customer()/restore_customer()';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger customers_protect_immutable
  before update on public.customers
  for each row execute function public.protect_immutable_columns();

-- =====================================================================
-- 7. soft_delete_customer / restore_customer RPCs
-- =====================================================================

create or replace function public.soft_delete_customer(customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.customers where id = customer_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Customer not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this customer';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.customers set deleted_at = now(), updated_by = auth.uid() where id = customer_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

create or replace function public.restore_customer(customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.customers where id = customer_id and deleted_at is not null;
  if v_tenant_id is null then
    raise exception 'Customer not found or not deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to restore this customer';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.customers set deleted_at = null, updated_by = auth.uid() where id = customer_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

-- =====================================================================
-- 8. Enable RLS
-- =====================================================================

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;

-- =====================================================================
-- 9. RLS policies — tenants
-- =====================================================================

create policy tenants_select on public.tenants
  for select using (
    deleted_at is null
    and id in (select public.user_tenant_ids())
  );

-- Tenant management (name/slug/status) — owner only, not admin: this is a
-- higher privilege tier than regular CRUD.
create policy tenants_update on public.tenants
  for update using (
    public.user_tenant_role(id) = 'owner'
  )
  with check (
    public.user_tenant_role(id) = 'owner'
  );

-- No INSERT/DELETE policy on tenants via direct CRUD at all. Creating a new
-- tenant (future signup flow) and deleting one are dedicated RPCs, out of
-- scope for this PoC. The first tenant is created via manual seed (step
-- below), which runs with elevated (service_role) privileges, bypassing RLS.

-- =====================================================================
-- 10. RLS policies — tenant_memberships
-- =====================================================================

create policy memberships_select on public.tenant_memberships
  for select using (
    deleted_at is null
    and (
      profile_id = auth.uid()
      or public.is_tenant_admin(tenant_id)
    )
  );

-- Membership management (role changes, adding members) — owner/admin only,
-- not free CRUD for members.
create policy memberships_insert on public.tenant_memberships
  for insert with check (
    public.is_tenant_admin(tenant_id)
  );

create policy memberships_update on public.tenant_memberships
  for update using (
    public.is_tenant_admin(tenant_id)
  )
  with check (
    public.is_tenant_admin(tenant_id)
  );

-- Membership deletion/restoration (deleted_at) is a future dedicated RPC
-- (invite_member/remove_member), out of scope for this PoC.

-- =====================================================================
-- 11. RLS policies — customers
-- =====================================================================

create policy customers_select on public.customers
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy customers_insert on public.customers
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

-- Single UPDATE policy (no overlapping delete policy) — regular business
-- fields only. deleted_at is not reachable through this policy in practice
-- (see soft_delete_customer/restore_customer above); the WITH CHECK also
-- keeps tenant_id from moving to a different tenant the user belongs to.
create policy customers_update on public.customers
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
-- 12. RLS policies — profiles
-- =====================================================================

create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or id in (
      select tm.profile_id from public.tenant_memberships tm
      where tm.tenant_id in (select public.user_tenant_ids())
        and tm.deleted_at is null
    )
  );

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- =====================================================================
-- End of 0001_poc_core.sql
-- =====================================================================
