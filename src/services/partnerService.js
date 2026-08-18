import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.Partner full CRUD. delete() was added in
// Phase 9 — PartnerSettlement.jsx performs partner deletion (with a
// window.confirm) that was missed in Phase 3, since Finance.jsx/
// Dashboard.jsx (the screens covered then) never delete a partner. See
// docs/PHASE_9_IMPLEMENTATION_PLAN.md section 2.
export const PartnerService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('partners').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('partners')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    // Same immutable-field stripping as customerService.update — see that
    // file for the full rationale (RLS WITH CHECK alone can't distinguish
    // which columns changed within a single UPDATE).
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('partners')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    // Soft delete via RPC, not a direct UPDATE — same reasoning as
    // CustomerService.delete (see SUPABASE_SCHEMA_PLAN.md section 6.3).
    const { error } = await supabase.rpc('soft_delete_partner', { partner_id: id });
    if (error) throw error;
  },
};

// Identical to customerService.js/projectService.js's getActiveTenantId —
// duplicated deliberately rather than extracted, per the same reasoning
// documented in projectService.js (wait for a third+ call site before
// guessing at the shared abstraction's shape).
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
