import { supabase, excludeDeleted } from './client';

const BUCKET = 'project-files';
const SIGNED_URL_TTL_SECONDS = 3600;

// list()/delete() have existed since Phase 4. create()/update()/
// uploadFile()/getFileUrl() were added in Phase 10 for
// ProjectDetails.jsx's QuotesSection — NOT for Quotes.jsx.
//
// Quotes.jsx (Phase 4) deliberately keeps create() on Base44 for its own
// "new quote" flow: it navigates immediately to QuoteEditor.jsx by id
// after creating a quote, and QuoteEditor.jsx hasn't migrated — creating
// in Supabase there would hand it a UUID it can't find in Base44,
// breaking that screen (see docs/PHASE_4_IMPLEMENTATION_PLAN.md section
// 9). That risk does NOT apply here: ProjectDetails.jsx's QuotesSection
// never navigates to QuoteEditor.jsx after create/update — it just
// closes its dialog and refreshes its own list in place (verified by
// reading ProjectDetails.jsx in full — see
// docs/PHASE_10_IMPLEMENTATION_PLAN.md section 2). Both screens now
// read/write the same project_quotes table; only this Service's
// create/update are new, and only ProjectDetails.jsx calls them. Do not
// wire Quotes.jsx's create button to these methods without re-checking
// that reasoning first.
export const ProjectQuoteService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('project_quotes').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async listByProject(projectId) {
    const { data, error } = await excludeDeleted(
      supabase.from('project_quotes').select('*').eq('project_id', projectId).order('addition_number', { ascending: true })
    );
    if (error) throw error;
    return data;
  },

  // Added in Phase 11 for QuoteEditor.jsx, which loads a single quote by
  // id from the URL query string.
  async get(id) {
    const { data, error } = await excludeDeleted(
      supabase.from('project_quotes').select('*').eq('id', id)
    ).single();
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('project_quotes')
      .insert({ ...sanitizeDates(data), tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('project_quotes')
      .update(sanitizeDates(safeData))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    // Soft delete via RPC, not a direct UPDATE — same reasoning as
    // CustomerService.delete (see SUPABASE_SCHEMA_PLAN.md section 6.3).
    const { error } = await supabase.rpc('soft_delete_project_quote', { quote_id: id });
    if (error) throw error;
  },

  // Uploads a quote PDF attachment to the shared project-files bucket
  // (also used by DocumentService) under
  // {tenant_id}/project-quotes/{quoteId}/{timestamp}_{filename}. Returns
  // the Storage path, not a URL — same pattern as
  // CompanyHeaderService.uploadLogo (Phase 6).
  async uploadFile(file, quoteId) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);
    const sanitized = sanitizeFilename(file.name);
    const path = `${tenantId}/project-quotes/${quoteId}/${Date.now()}_${sanitized}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file);
    if (error) throw error;

    return path;
  },

  async getFileUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  },
};

// Same empty-string-date fix as ProjectService.create/ReminderService.create
// — HTML date <input>s left unset render as "" rather than undefined,
// which Postgres date columns reject ("invalid input syntax for type
// date"). Found in Phase 11 manual testing: QuoteEditor.jsx's
// valid_until field triggered this on save. Applied to both create and
// update, and to both date columns on project_quotes.
function sanitizeDates(data) {
  const sanitized = { ...data };
  for (const field of ['quote_date', 'valid_until']) {
    if (sanitized[field] === '') sanitized[field] = null;
  }
  return sanitized;
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .substring(0, 100);
}

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
