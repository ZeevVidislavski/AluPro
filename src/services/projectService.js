import { supabase, excludeDeleted } from './client';

// Mirrors the subset of base44.entities.Project that src/pages/Projects.jsx
// actually uses — list + create only. update/delete exist only in
// ProjectDetails.jsx, which has NOT migrated yet (see
// docs/PHASE_2_IMPLEMENTATION_PLAN.md section 0) — do not add them here
// speculatively; that scope decision was made deliberately, not by
// omission.
//
// tenant_id/created_by are injected here, same as CustomerService.create
// — see docs/BASE44_REPLACEMENT_MAP.md and ADR-08. project_number is NOT
// set by the caller at all (unlike Base44's client-side
// `P${Date.now()...}` generation) — it's assigned atomically by a
// Postgres sequence in the table's DEFAULT expression (see
// supabase/migrations/0003_projects.sql section 1), fixing the known
// non-uniqueness bug from AUDIT_REPORT_2026-08-03.md.
export const ProjectService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('projects').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  // Added in Phase 10 for ProjectDetails.jsx, which loads a single
  // project by id from the URL query string.
  async get(id) {
    const { data, error } = await excludeDeleted(
      supabase.from('projects').select('*').eq('id', id)
    ).single();
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    // project_number is deliberately NOT included here — the DB assigns
    // it. If the caller's `data` object happens to include one (e.g. a
    // stale form field), strip it so it can't silently override the
    // sequence-generated value.
    const { project_number, ...payload } = data;

    // Base44's forms leave empty date inputs as "" (empty string), which
    // Postgres date columns reject ("invalid input syntax for type
    // date"). Base44/NoSQL apparently tolerated "" silently; Postgres
    // does not. Coerce empty-string date fields to null here — this is
    // the single place all callers (currently just Projects.jsx) go
    // through, so the fix doesn't need repeating per-caller. Discovered
    // via manual browser testing, not anticipated in the original plan.
    const sanitized = { ...payload };
    for (const field of ['start_date', 'target_date']) {
      if (sanitized[field] === '') sanitized[field] = null;
    }

    const { data: created, error } = await supabase
      .from('projects')
      .insert({ ...sanitized, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  // Added in Phase 10 for ProjectDetails.jsx's edit dialog. Strips
  // project_number too (immutable at the DB level via the sequence
  // default, but stripped here defensively same as create()'s handling).
  async update(id, data) {
    const { tenant_id, created_by, deleted_at, project_number, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('projects')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  // Replaces ProjectDetails.jsx's hardcoded closed_by: "מנהל" (a fixed
  // string in the original Base44 code) with the real authenticated
  // user's id — closed_by is a genuine FK to profiles in this schema
  // (see supabase/migrations/0003_projects.sql), unlike Base44's loose
  // string field.
  async closeSettlement(id) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const { data: updated, error } = await supabase
      .from('projects')
      .update({
        settlement_status: 'closed',
        closed_at: new Date().toISOString().split('T')[0],
        closed_by: user.id,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async reopenSettlement(id) {
    const { data: updated, error } = await supabase
      .from('projects')
      .update({ settlement_status: 'open', closed_at: null, closed_by: null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_project', { project_id: id });
    if (error) throw error;
  },
};

// Identical logic to customerService.js's getActiveTenantId — duplicated
// rather than extracted into client.js for now, since this is the second
// (not yet third+) call site; see docs/SUPABASE_SCHEMA_PLAN.md section 4
// for the "Active Tenant" resolution strategy this implements (Alternative
// 1, single membership). If a third service needs this, extract it into
// client.js then rather than now — avoids guessing at the right shared
// abstraction before there's enough evidence of what it should look like.
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
