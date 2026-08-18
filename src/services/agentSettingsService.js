import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.AgentSettings — list/create/update only, no
// delete (no delete UI exists). BusinessAgent.jsx treats this as a
// tenant singleton (always reads settings[0]) and owns the
// create-vs-update decision itself; this service intentionally exposes
// only the raw CRUD primitives, not an upsert, to avoid duplicating that
// decision in two places (see docs/PHASE_8_IMPLEMENTATION_PLAN.md section 4).
export const AgentSettingsService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('agent_settings').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('agent_settings')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('agent_settings')
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
