import { supabase } from './client';

// Tenant-scoped team management — distinct from platformAdminService.js,
// which is platform-admin-only (Zeev, across all tenants). Everything
// here relies on the caller's OWN tenant membership and the existing
// memberships_select/memberships_insert RLS policies
// (supabase/migrations/0001_poc_core.sql) — no RLS bypass involved, since
// a tenant admin only ever needs to see/manage their own tenant's team.
export const TeamService = {
  // Returns the caller's own tenant + role in it, not just tenant_id —
  // the Team page needs the role too, to decide whether to show the
  // invite form at all (see PlatformAdminGuard.jsx for the equivalent
  // "convenience gate, not the real boundary" reasoning; the real
  // boundary here is is_tenant_admin() inside the Edge Function).
  async getActiveTenantContext() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Not authenticated');

    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('tenant_id, role')
      .eq('profile_id', user.id)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (error || !data) throw new Error('No active tenant membership found for this user');
    return data;
  },

  async listMembers(tenantId) {
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('*, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Creates the new teammate's auth user AND their tenant_memberships row
  // via the tenant-invite-member Edge Function (see supabase/functions/
  // — needs the service_role key to create an auth user, which a
  // browser-callable SQL RPC cannot hold).
  async inviteMember({ tenantId, email, password, fullName, role }) {
    const { data, error } = await supabase.functions.invoke('tenant-invite-member', {
      body: { tenantId, email, password, fullName, role },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data; // { tenantId, memberId }
  },
};
