import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.AgentAlert — list/create/update only, no
// delete (alerts are marked is_handled, never removed). list() returns
// everything; filtering (is_handled, alert_type, project_id) happens in
// memory in BusinessAgent.jsx/MorningSummary.jsx, same as the original
// Base44 usage — not reimplemented as query params here.
export const AgentAlertService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('agent_alerts').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('agent_alerts')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('agent_alerts')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
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
