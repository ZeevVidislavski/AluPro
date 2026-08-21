import { supabase } from './client';

const STORAGE_BUCKETS = ['project-files', 'company-logos'];
const LIST_PAGE_SIZE = 100;

// Recursively sums metadata.size (bytes) for every object under `prefix`
// in `bucket`. Supabase Storage's list() is NOT recursive (only returns
// immediate children of a folder) and is paginated (~100/page by
// default), so this walks folders depth-first and pages through each
// folder's results. A "folder" entry has no `id`/`metadata` (this is the
// documented way the Supabase JS client distinguishes a folder
// placeholder from a real file in list() responses) — unverified against
// a live project, flagged the same way 0008/0012 flag untested
// Storage-API assumptions.
async function sumFolderBytes(bucket, prefix) {
  let total = 0;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      if (entry.id === null) {
        total += await sumFolderBytes(bucket, `${prefix}/${entry.name}`);
      } else {
        total += entry.metadata?.size ?? 0;
      }
    }

    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }
  return total;
}

// M1 shipped reads only; M2 (0019_platform_create_tenant.sql) adds the
// writes below: tenant creation, status changes, and billing edits. Every
// method here relies on the platform-admin RLS bypass/RPCs added in
// supabase/migrations/0018_platform_admin_rls_bypass.sql,
// 0019_platform_create_tenant.sql and the SECURITY DEFINER functions in
// 0016/0017/0019; a non-platform-admin caller gets empty results (or an
// RLS-denied/RPC exception on write attempts), never another tenant's
// data.
export const PlatformAdminService = {
  async checkSelf() {
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) throw error;
    return data;
  },

  async listTenants() {
    const { data, error } = await supabase
      .from('tenants')
      .select('*, tenant_subscriptions(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getTenant(tenantId) {
    const { data, error } = await supabase
      .from('tenants')
      .select('*, tenant_subscriptions(*)')
      .eq('id', tenantId)
      .single();
    if (error) throw error;
    return data;
  },

  async getTenantUsage(tenantId) {
    const { data, error } = await supabase.rpc('platform_tenant_usage', { p_tenant_id: tenantId });
    if (error) throw error;
    return data?.[0] ?? { user_count: 0, project_count: 0, customer_count: 0 };
  },

  async listTenantMembers(tenantId) {
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('*, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Links an owner who ALREADY has a Supabase Auth account. Kept as a
  // fallback path; the normal flow is createTenantWithNewUser below,
  // which also creates the auth user itself so Zeev never touches
  // Supabase directly.
  async createTenant({ name, slug, ownerEmail }) {
    const { data, error } = await supabase.rpc('platform_create_tenant', {
      p_name: name,
      p_slug: slug,
      p_owner_email: ownerEmail,
    });
    if (error) throw error;
    return data; // new tenant id
  },

  // Creates the owner's auth user AND the tenant AND the owner
  // membership in one call, via the platform-create-tenant-with-user
  // Edge Function (see supabase/functions/ — this needs the service_role
  // key to create an auth user, which a browser-callable SQL RPC cannot
  // hold).
  async createTenantWithNewUser({ name, slug, ownerEmail, ownerPassword, ownerFullName }) {
    const { data, error } = await supabase.functions.invoke('platform-create-tenant-with-user', {
      body: { name, slug, ownerEmail, ownerPassword, ownerFullName },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data; // { tenantId, ownerId }
  },

  async setTenantStatus(tenantId, status) {
    const { error } = await supabase.rpc('platform_set_tenant_status', {
      p_tenant_id: tenantId,
      p_status: status,
    });
    if (error) throw error;
  },

  async updateSubscription(tenantId, fields) {
    const { data, error } = await supabase
      .from('tenant_subscriptions')
      .upsert({ tenant_id: tenantId, ...fields }, { onConflict: 'tenant_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // On-demand only (not scheduled) — recomputes on every call, no
  // caching/persistence. Relies on the platform-admin Storage RLS
  // bypass (supabase/migrations/0021_storage_platform_admin_bypass.sql)
  // — a plain anon-key client call is sufficient, no Edge Function
  // needed, since Storage listing is checked against storage.objects
  // RLS, not service_role.
  async calculateTenantStorageUsage(tenantId) {
    let totalBytes = 0;
    for (const bucket of STORAGE_BUCKETS) {
      totalBytes += await sumFolderBytes(bucket, tenantId);
    }
    return {
      bytes: totalBytes,
      gb: totalBytes / 1024 ** 3,
    };
  },
};
