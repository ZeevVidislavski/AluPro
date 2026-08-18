import { supabase, excludeDeleted } from './client';

// list() was the only method through Phase 3 — same reasoning as
// clientPaymentService.js. SupplierOrder CRUD lived exclusively in
// ProjectDetails.jsx. Extended in Phase 10.
export const SupplierOrderService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('supplier_orders').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async listByProject(projectId) {
    const { data, error } = await excludeDeleted(
      supabase.from('supplier_orders').select('*').eq('project_id', projectId).order('order_date', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('supplier_orders')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('supplier_orders')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_supplier_order', { order_id: id });
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
