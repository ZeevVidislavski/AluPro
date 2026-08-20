-- =====================================================================
-- 0019_platform_create_tenant.sql
-- Super-admin console, milestone M2 (part 1/2): Zeev-only tenant creation
-- and suspend/reactivate, plus write access to tenant_subscriptions.
--
-- Per the approved plan, M1 shipped read-only; this is the first
-- milestone that lets a platform admin actually change data.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

-- =====================================================================
-- 1. platform_create_tenant — creates a tenant + its first owner
--    membership in one transaction.
--
-- A regular INSERT through the existing tenants/tenant_memberships RLS
-- policies doesn't work here: tenants has no INSERT policy at all (by
-- design, see 0001_poc_core.sql comment), and memberships_insert requires
-- the caller to already be is_tenant_admin() of the target tenant — which
-- is impossible for a brand-new tenant nobody is a member of yet. Hence a
-- dedicated SECURITY DEFINER RPC, gated by is_platform_admin() itself
-- rather than by any table-level RLS policy.
--
-- The owner's auth user must already exist (Zeev creates it via the
-- Supabase dashboard first, same manual step already used for every
-- tenant/user so far) — this RPC links an existing auth user to a new
-- tenant, it does not create auth.users rows (that requires the admin
-- API / service_role, not available to a plain SECURITY DEFINER SQL
-- function called from the client).
-- =====================================================================

create or replace function public.platform_create_tenant(
  p_name text,
  p_slug text,
  p_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_owner_profile_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Insufficient permissions: platform admin only';
  end if;

  select id into v_owner_profile_id from auth.users where email = p_owner_email;
  if v_owner_profile_id is null then
    raise exception 'No auth user found for email %. Create the user in Supabase Auth first.', p_owner_email;
  end if;

  -- profiles row may not exist yet if this is the owner's very first
  -- tenant anywhere (same gap noted in supabase/seed/0005_fix_membership
  -- _owner.sql — no signup trigger creates it automatically yet).
  insert into public.profiles (id)
  values (v_owner_profile_id)
  on conflict (id) do nothing;

  insert into public.tenants (name, slug)
  values (p_name, p_slug)
  returning id into v_tenant_id;

  insert into public.tenant_memberships (tenant_id, profile_id, role)
  values (v_tenant_id, v_owner_profile_id, 'owner');

  insert into public.tenant_subscriptions (tenant_id)
  values (v_tenant_id);

  return v_tenant_id;
end;
$$;

grant execute on function public.platform_create_tenant(text, text, text) to authenticated;

-- =====================================================================
-- 2. platform_set_tenant_status — suspend/reactivate/cancel a tenant.
--
-- Not folded into the existing tenants_update policy (owner-only, for
-- name/slug/status edits by the tenant's OWN owner) because this is a
-- distinct, higher-privilege action: Zeev suspending someone else's
-- tenant should be its own explicit, auditable path, not silently
-- piggybacked on the tenant-owner's self-management policy.
-- =====================================================================

create or replace function public.platform_set_tenant_status(p_tenant_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Insufficient permissions: platform admin only';
  end if;
  if p_status not in ('active', 'suspended', 'cancelled') then
    raise exception 'Invalid status: %', p_status;
  end if;

  update public.tenants set status = p_status, updated_at = now() where id = p_tenant_id;
end;
$$;

grant execute on function public.platform_set_tenant_status(uuid, text) to authenticated;

-- =====================================================================
-- 3. tenant_subscriptions write policies — M1 shipped select-only; this
--    adds insert/update, both scoped to is_platform_admin() (matching
--    the select policy from 0017_tenant_subscriptions.sql). The GRANT
--    already covers insert/update from 0017; only the missing RLS
--    policies are added here.
-- =====================================================================

create policy tenant_subscriptions_insert on public.tenant_subscriptions
  for insert with check (
    public.is_platform_admin()
  );

create policy tenant_subscriptions_update on public.tenant_subscriptions
  for update using (
    public.is_platform_admin()
  )
  with check (
    public.is_platform_admin()
  );

-- =====================================================================
-- End of 0019_platform_create_tenant.sql
-- =====================================================================
