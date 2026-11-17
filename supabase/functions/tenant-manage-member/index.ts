// Tenant-level "edit teammate" + "reset teammate password".
// Same authorization model as tenant-invite-member: the CALLER's JWT is
// checked with is_tenant_admin(tenantId) first, only then the service_role
// client is used (needed for auth.admin.* and for editing another user's
// profiles row, which RLS only allows for self).
//
// Actions (body.action):
//   "update"         { tenantId, memberId (tenant_memberships.id), fullName?, email?, role? }
//   "reset-password" { tenantId, memberId, password }
//
// Rules: role 'owner' can never be assigned here, and an owner's role can't
// be changed. Only an owner may modify/reset another owner.
//
// Deploy: `supabase functions deploy tenant-manage-member`

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["admin", "member", "viewer"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { action, tenantId, memberId, fullName, email, role, password } = await req.json();
    if (!action || !tenantId || !memberId) {
      return json({ error: "action, tenantId and memberId are required" }, 400);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isTenantAdmin, error: adminCheckError } = await callerClient.rpc("is_tenant_admin", {
      p_tenant_id: tenantId,
    });
    if (adminCheckError || !isTenantAdmin) {
      return json({ error: "Insufficient permissions: tenant owner/admin only" }, 403);
    }

    const { data: callerUser } = await callerClient.auth.getUser();
    const callerId = callerUser?.user?.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership, error: membershipLookupError } = await adminClient
      .from("tenant_memberships")
      .select("id, profile_id, role")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (membershipLookupError || !membership) {
      return json({ error: "Member not found in this tenant" }, 404);
    }

    if (membership.role === "owner") {
      const { data: callerMembership } = await adminClient
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", tenantId)
        .eq("profile_id", callerId)
        .is("deleted_at", null)
        .maybeSingle();
      if (callerMembership?.role !== "owner") {
        return json({ error: "Only an owner can modify another owner" }, 403);
      }
    }

    if (action === "reset-password") {
      if (!password || String(password).length < 6) {
        return json({ error: "password must be at least 6 characters" }, 400);
      }
      const { error } = await adminClient.auth.admin.updateUserById(membership.profile_id, { password });
      if (error) return json({ error: `Failed to reset password: ${error.message}` }, 400);
      return json({ memberId });
    }

    if (action === "update") {
      if (role !== undefined && role !== membership.role) {
        if (membership.role === "owner") {
          return json({ error: "An owner's role cannot be changed here" }, 400);
        }
        if (!ALLOWED_ROLES.includes(role)) {
          return json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` }, 400);
        }
        const { error } = await adminClient
          .from("tenant_memberships")
          .update({ role })
          .eq("id", memberId);
        if (error) return json({ error: `Failed to update role: ${error.message}` }, 400);
      }

      if (fullName !== undefined) {
        const { error } = await adminClient
          .from("profiles")
          .update({ full_name: fullName || null })
          .eq("id", membership.profile_id);
        if (error) return json({ error: `Failed to update name: ${error.message}` }, 400);
      }

      if (email) {
        const { error } = await adminClient.auth.admin.updateUserById(membership.profile_id, {
          email,
          email_confirm: true,
        });
        if (error) return json({ error: `Failed to update email: ${error.message}` }, 400);
      }

      return json({ memberId });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
