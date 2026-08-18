import { supabase, excludeDeleted } from './client';

const BUCKET = 'company-logos';
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour, per PHASE_6_IMPLEMENTATION_PLAN.md decision 2

// Mirrors base44.entities.CompanyHeader full CRUD, plus two capabilities
// Base44 didn't need: uploadLogo/getLogoUrl, because logo_url here is an
// internal Storage path, not a permanent public URL (see
// docs/PHASE_6_IMPLEMENTATION_PLAN.md section 3). "Remove logo" (in
// CompanyHeaders.jsx) only nulls logo_url on the record — it does NOT
// delete the underlying Storage object (decision 3, deliberate: orphaned
// files are cleaned up later, not in this phase).
export const CompanyHeaderService = {
  async list() {
    const { data, error } = await excludeDeleted(
      supabase.from('company_headers').select('*').order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('company_headers')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('company_headers')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    // Soft delete via RPC, not a direct UPDATE — same reasoning as
    // CustomerService.delete/ProjectQuoteService.delete.
    const { error } = await supabase.rpc('soft_delete_company_header', { header_id: id });
    if (error) throw error;
  },

  // Implements the "only one default header" invariant from
  // CompanyHeaders.jsx (setDefault mutation, original line 40): unsets
  // is_default on every header except the chosen one, in the same
  // tenant. Not a single UPDATE (the RLS update policy filters by row,
  // there's no bulk-toggle-except-one primitive) — mirrors the
  // Promise.all(headers.map(...)) approach from the original component.
  async setDefault(id) {
    const headers = await this.list();
    await Promise.all(
      headers.map((h) => this.update(h.id, { is_default: h.id === id }))
    );
  },

  // Uploads a file to the private company-logos bucket under
  // {tenant_id}/company-headers/{headerId}/{timestamp}_{filename}, and
  // returns the Storage path (NOT a URL) — callers store this path in
  // company_headers.logo_url and resolve it to a signed URL via
  // getLogoUrl() whenever it needs to be displayed.
  async uploadLogo(file, headerId) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);
    const sanitized = sanitizeFilename(file.name);
    const path = `${tenantId}/company-headers/${headerId}/${Date.now()}_${sanitized}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file);
    if (error) throw error;

    return path;
  },

  // Resolves a stored Storage path to a time-limited signed URL for
  // display (<img src>). Must be called at render/fetch time, not
  // cached indefinitely — the URL expires after SIGNED_URL_TTL_SECONDS.
  async getLogoUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  },
};

function sanitizeFilename(filename) {
  return filename
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .substring(0, 100);
}

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
