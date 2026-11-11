import { supabase, excludeDeleted } from './client';

// Per-company suppliers list (name, contact, phone, e-mail). See
// supabase/migrations/0026_suppliers.sql. Same shape as PartnerService.
export const SupplierService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('suppliers').select('*').order('name', { ascending: true })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('suppliers')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_supplier', { supplier_id: id });
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
