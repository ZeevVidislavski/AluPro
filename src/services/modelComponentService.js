import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.ModelComponent, used by ModelComponentsTab.jsx
// (the "manufacturing recipe" editor for a single model_pricing row).
// Always queried filtered by model_id — there's no unfiltered list() in
// the UI, so none is exposed here either.
export const ModelComponentService = {
  async listByModel(modelId) {
    const { data, error } = await excludeDeleted(
      supabase.from('model_components').select('*').eq('model_id', modelId)
    );
    if (error) throw error;
    return data;
  },

  async create(modelId, data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('model_components')
      .insert({ ...data, model_id: modelId, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, model_id, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('model_components')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  // Bulk update for ModelComponentsTab.jsx's handleSaveCalcResults, which
  // writes calculated_length/calculated_width back to several components
  // at once after running the opening-size calculator.
  async updateMany(updates) {
    return Promise.all(updates.map(({ id, data }) => this.update(id, data)));
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_model_component', { component_id: id });
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
