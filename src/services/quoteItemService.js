import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.QuoteItem full CRUD, used by QuoteEditor.jsx.
// Base44 hard-deletes these; here delete() is a soft delete via RPC for
// consistency with every other deletable table in this project — a
// deliberate divergence from the original, decided under Auto Mode (see
// docs/PHASE_11_IMPLEMENTATION_PLAN.md section 5).
export const QuoteItemService = {
  async listByQuote(quoteId) {
    const { data, error } = await excludeDeleted(
      supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('sort_order', { ascending: true })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('quote_items')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, quote_id, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('quote_items')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_quote_item', { item_id: id });
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
