import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.MaterialOrder full CRUD, used by
// materialOrderGenerator.js and MaterialOrdersTab.jsx. Soft delete via
// RPC — Base44 hard-deletes these, diverging for consistency with the
// rest of this project (same choice as quote_items, Phase 11).
export const MaterialOrderService = {
  async listByProject(projectId) {
    const { data, error } = await excludeDeleted(
      supabase.from('material_orders').select('*').eq('project_id', projectId)
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('material_orders')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('material_orders')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_material_order', { order_id: id });
    if (error) throw error;
  },
};

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
