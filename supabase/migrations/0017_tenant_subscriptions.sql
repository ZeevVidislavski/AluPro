-- =====================================================================
-- 0017_tenant_subscriptions.sql
-- Super-admin console, milestone M1 (part 2/3): billing tracking +
-- on-demand usage counts.
--
-- Billing is MANUAL for phase 1 (Zeev updates payment_status/notes by
-- hand — see docs/SAAS_ARCHITECTURE.md section 5/6 for the aspirational
-- Stripe-webhook-driven design this deliberately does not build yet).
-- The stripe_* columns exist now, unused (always NULL, no app code writes
-- them), so a future real Stripe integration is an UPDATE of existing
-- columns, not a schema migration.
--
-- DEVIATION from SAAS_ARCHITECTURE.md: that doc splits this into
-- Subscription + separate Invoice + separate UsageRecord models (Prisma
-- pseudocode, never implemented). Phase 1 collapses billing into this one
-- manually-edited table and drops Invoice/UsageRecord entirely — usage is
-- computed on demand from existing tables (platform_tenant_usage below),
-- not stored as metering rows. Add Invoice/UsageRecord-style tables later
-- if historical billing/usage trending is actually needed.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

create table public.tenant_subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,

  plan                      text not null default 'starter'
                             check (plan in ('starter', 'pro', 'enterprise')),
  billing_type              text not null default 'rental'
                             check (billing_type in ('rental', 'purchase')),
  billing_cycle             text
                             check (billing_cycle in ('monthly', 'annual') or billing_cycle is null),
  payment_status            text not null default 'active'
                             check (payment_status in ('active', 'past_due', 'suspended', 'cancelled')),

  price_amount              numeric(12,2),
  currency                  text not null default 'ILS',
  purchased_at              date,
  current_period_start      date,
  current_period_end        date,
  notes                     text,

  -- Stripe-shaped, deliberately unused in phase 1 — see file header.
  stripe_customer_id        text,
  stripe_subscription_id    text,
  stripe_price_id           text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles(id),

  unique (tenant_id)
);

comment on table public.tenant_subscriptions is 'Manual billing/plan tracking (phase 1 — Zeev edits via the super-admin console, M2). plan uses text+check (not a Postgres enum) to match this project''s existing convention (see tenants.status, customers.customer_type). "starter" replaces SAAS_ARCHITECTURE.md''s "FREE" — there is no free tier in this business model, every tenant here is rental or purchase.';

create index tenant_subscriptions_tenant_id_idx on public.tenant_subscriptions (tenant_id);

alter table public.tenant_subscriptions enable row level security;

grant select, insert, update on public.tenant_subscriptions to authenticated;
-- Note: this GRANT looks broad, but RLS (added in 0018, alongside the rest
-- of the platform-admin bypass policies) restricts actual row access to
-- platform admins only — same "GRANT is necessary but not sufficient"
-- pattern already used throughout 0001-0015.

create policy tenant_subscriptions_select on public.tenant_subscriptions
  for select using (
    public.is_platform_admin()
  );

-- No insert/update policy yet in M1 (read-only milestone, per plan). M2
-- adds insert/update policies scoped to is_platform_admin() when the
-- billing-edit UI ships.

-- =====================================================================
-- On-demand usage counts (no metering table — see file header).
-- =====================================================================

create or replace function public.platform_tenant_usage(p_tenant_id uuid)
returns table (
  user_count integer,
  project_count integer,
  customer_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*)::integer from public.tenant_memberships
      where tenant_id = p_tenant_id and deleted_at is null),
    (select count(*)::integer from public.projects
      where tenant_id = p_tenant_id and deleted_at is null),
    (select count(*)::integer from public.customers
      where tenant_id = p_tenant_id and deleted_at is null)
  where public.is_platform_admin();
$$;

comment on function public.platform_tenant_usage(uuid) is 'Live usage counts for the super-admin tenant-detail screen. The `where public.is_platform_admin()` clause is a mandatory self-check, not decoration: this function is SECURITY DEFINER and bypasses RLS on tenant_memberships/projects/customers entirely, so it cannot rely on RLS for authorization the way a normal query would — it must refuse non-platform-admins itself. Returns an empty set (not an error) for non-platform-admins.';

grant execute on function public.platform_tenant_usage(uuid) to authenticated;

-- =====================================================================
-- End of 0017_tenant_subscriptions.sql
-- =====================================================================
