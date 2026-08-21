import { supabase } from './client';

// Tenant-scoped team management — distinct from platformAdminService.js,
// which is platform-admin-only (Zeev, across all tenants). Everything
// here relies on the caller's OWN tenant membership and the existing
// memberships_select/memberships_insert RLS policies
// (supabase/migrations/0001_poc_core.sql) — no RLS bypass involved, since
// a tenant admin only ever needs to see/manage their own tenant's team.
export const TeamService = {
  // Returns the caller's own tenant + role + plan — not just tenant_id.
  // Layout.jsx uses this single query for everything it needs to decide
  // what to show: the Team invite form (role), and plan-gated nav items
  // like BusinessAgent (plan). See PlatformAdminGuard.jsx for the
  // equivalent "convenience gate, not the real boundary" reasoning; the
  // real boundaries are is_tenant_admin() inside the invite Edge Function
  // and RLS itself for data access.
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

    // Separate query, not an embed — tenant_memberships has no direct FK
    // to tenant_subscriptions (it goes through tenants). Missing row
    // (.maybeSingle(), not .single()) defaults to 'starter' rather than
    // throwing, so a tenant without a subscription row yet doesn't break
    // the whole nav — gated features simply stay hidden, the safe default.
    const { data: subscription } = await supabase
      .from('tenant_subscriptions')
      .select('plan')
      .eq('tenant_id', data.tenant_id)
      .maybeSingle();

    return { ...data, plan: subscription?.plan ?? 'starter' };
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
