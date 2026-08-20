import { supabase } from './client';

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

  async createTenant({ name, slug, ownerEmail }) {
    const { data, error } = await supabase.rpc('platform_create_tenant', {
      p_name: name,
      p_slug: slug,
      p_owner_email: ownerEmail,
    });
    if (error) throw error;
    return data; // new tenant id
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
};
