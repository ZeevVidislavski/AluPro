import { supabase, excludeDeleted } from './client';

// Mirrors base44.entities.Reminder full CRUD. delete() was added in
// Phase 10 — ProjectDetails.jsx's RemindersSection deletes reminders,
// unlike Reminders.jsx (Phase 5 scope), which only changes status via a
// dropdown and never removes a row.
export const ReminderService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('reminders').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    // Same empty-string-date fix as ProjectService.create — Base44's
    // form leaves due_date as "" if somehow unset, which Postgres date
    // columns reject. due_date is required here (not null), so this
    // matters more than it did for projects' optional dates.
    const sanitized = { ...data };
    if (sanitized.due_date === '') sanitized.due_date = null;

    const { data: created, error } = await supabase
      .from('reminders')
      .insert({ ...sanitized, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    // Same immutable-field stripping as customerService/projectService.
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('reminders')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_reminder', { reminder_id: id });
    if (error) throw error;
  },
};

// Identical to other services' getActiveTenantId — duplicated
// deliberately, per the reasoning in projectService.js.
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
