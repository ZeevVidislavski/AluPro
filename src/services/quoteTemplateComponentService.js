import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.QuoteTemplateComponent, used by
// ModelPricing.jsx (loading all templates' components) and
// TemplateComponentsManager.jsx (per-template CRUD).
//
// ModelPricing.jsx queries components per-template via Promise.all, one
// call per template — preserved here as listByTemplate(id) rather than a
// single "in (...)" query, matching the existing Base44 behavior exactly
// (see docs/PHASE_7_IMPLEMENTATION_PLAN.md section 7.1).
export const QuoteTemplateComponentService = {
  async listByTemplate(templateId) {
    const { data, error } = await excludeDeleted(
      supabase.from('quote_template_components').select('*').eq('template_id', templateId)
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('quote_template_components')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, template_id, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('quote_template_components')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_quote_template_component', { component_id: id });
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
