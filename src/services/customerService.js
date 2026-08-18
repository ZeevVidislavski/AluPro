import { supabase, excludeDeleted } from './client';

// Mirrors the base44.entities.Customer interface (list/create/update/delete)
// so Customers.jsx only needs an import swap, not a rewrite — see
// docs/BASE44_REPLACEMENT_MAP.md and ADR-08 in docs/ARCHITECTURE_DECISIONS.md.
//
// tenant_id/created_by are injected here, not by the caller — the RLS
// INSERT policy on customers requires created_by = auth.uid() and
// tenant_id to be one of the caller's memberships (see
// supabase/migrations/0001_poc_core.sql). Customers.jsx's emptyCustomer
// object intentionally has no tenant_id/created_by fields; this service
// is the single place that resolves them.
export const CustomerService = {
  async list() {
    // base44's `.list('-created_date')` meant "newest first" — created_at
    // here is the equivalent column.
    const { data, error } = await excludeDeleted(
      supabase.from('customers').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await excludeDeleted(
      supabase.from('customers').select('*').eq('id', id)
    ).single();
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('customers')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    // tenant_id/created_by/deleted_at are immutable at the DB level
    // (protect_immutable_columns trigger) — stripping them here too so a
    // stray field on the form object can't even attempt the change.
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('customers')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    // Soft delete via RPC, NOT a direct UPDATE — see
    // SUPABASE_SCHEMA_PLAN.md section 6.3 for why a generic UPDATE
    // policy can't safely gate deleted_at changes by role.
    const { error } = await supabase.rpc('soft_delete_customer', { customer_id: id });
    if (error) throw error;
  },

  async restore(id) {
    const { error } = await supabase.rpc('restore_customer', { customer_id: id });
    if (error) throw error;
  },
};

// Active tenant resolution — Alternative 1 (single membership) from
// SUPABASE_SCHEMA_PLAN.md section 4. Deliberately written to tolerate
// (not crash on) a user with zero or multiple memberships, since the
// schema doesn't enforce single-membership — see that section for the
// planned upgrade path (active_tenant_id / JWT claims / picker UI).
async function getActiveTenantId(userId) {
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('profile_id', userId)
    .is('deleted_at', null)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('No active tenant membership found for this user');
  }
  return data.tenant_id;
}
