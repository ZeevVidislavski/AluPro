import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.QuoteItemComponent full CRUD, used by
// QuoteEditor.jsx. Same snapshot pattern as
// QuoteTemplateComponentService (Phase 7) — pricing_method_snapshot
// intentionally keeps a different enum than model_pricing.pricing_method
// (see PHASE_7_IMPLEMENTATION_PLAN.md section 1.5). Soft delete via RPC,
// same divergence-from-Base44 reasoning as QuoteItemService.
export const QuoteItemComponentService = {
  async listByQuoteItem(quoteItemId) {
    const { data, error } = await excludeDeleted(
      supabase.from('quote_item_components').select('*').eq('quote_item_id', quoteItemId).order('sort_order', { ascending: true })
    );
    if (error) throw error;
    return data;
  },

  // QuoteEditor.jsx loads all components for all items of a quote at
  // once via Promise.all, one call per item — preserved here as the
  // same shape (an array of listByQuoteItem calls), not unified into a
  // single "in (...)" query, matching the existing behavior exactly (see
  // the identical decision for QuoteTemplateComponentService in Phase 7).
  async listByQuoteItems(quoteItemIds) {
    const results = await Promise.all(quoteItemIds.map((id) => this.listByQuoteItem(id)));
    return results.flat();
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('quote_item_components')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, quote_item_id, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('quote_item_components')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_quote_item_component', { component_id: id });
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
