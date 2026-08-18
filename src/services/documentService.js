import { supabase, excludeDeleted } from './client';

const BUCKET = 'project-files';
const SIGNED_URL_TTL_SECONDS = 3600;

// Mirrors base44.entities.Document full CRUD, used by ProjectDetails.jsx's
// DocumentsSection. New in Phase 10 — Document never had a dedicated
// screen before (Phase 5 explicitly deferred it, see
// PHASE_5_IMPLEMENTATION_PLAN.md section 0). file_url is an internal
// Storage path in the shared project-files bucket (also used by
// ProjectQuoteService), not a public URL — same pattern as
// CompanyHeaderService (Phase 6).
export const DocumentService = {
  async listByProject(projectId) {
    const { data, error } = await excludeDeleted(
      supabase.from('documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async create(data) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);

    const { data: created, error } = await supabase
      .from('documents')
      .insert({ ...data, tenant_id: tenantId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { tenant_id, created_by, deleted_at, ...safeData } = data;
    const { data: updated, error } = await supabase
      .from('documents')
      .update(safeData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  async delete(id) {
    const { error } = await supabase.rpc('soft_delete_document', { document_id: id });
    if (error) throw error;
  },

  // Uploads to {tenant_id}/documents/{documentId}/{timestamp}_{filename}
  // in the shared project-files bucket. Returns the Storage path.
  async uploadFile(file, documentId) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const tenantId = await getActiveTenantId(user.id);
    const sanitized = sanitizeFilename(file.name);
    const path = `${tenantId}/documents/${documentId}/${Date.now()}_${sanitized}`;

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
