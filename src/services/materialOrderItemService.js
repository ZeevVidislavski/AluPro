import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.MaterialOrderItem full CRUD.
export const MaterialOrderItemService = {
  async listByOrder(materialOrderId) {
    const { data, error } = await excludeDeleted(
      supabase.from('material_order_items').select('*').eq('material_order_id', materialOrderId)
    );
    if (error) throw error;
    return data;
  },

  // materialOrderGenerator.js loads items for several orders at once via
  // Promise.all, one call per order — preserved here as the same shape,
  // matching the identical decision for QuoteItemComponentService
  // (Phase 11) and QuoteTemplateComponentService (Phase 7).
  async listByOrders(materialOrderIds) {
    const results = await Promise.all(materialOrderIds.map((id) => this.listByOrder(id)));
    return results.flat();
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('material_order_items')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_material_order_item', { item_id: id });
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
