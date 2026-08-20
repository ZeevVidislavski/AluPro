import { supabase } from './client';

// Reads only in M1 (see docs/SAAS_ARCHITECTURE.md deviation table + the
// approved plan) — billing edits and tenant creation land in M2. Every
// method here relies on the platform-admin RLS bypass added in
// supabase/migrations/0018_platform_admin_rls_bypass.sql and the
// SECURITY DEFINER functions in 0016/0017; a non-platform-admin caller
// gets empty results (or an RLS-denied error on write attempts later),
// never another tenant's data.
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
};
