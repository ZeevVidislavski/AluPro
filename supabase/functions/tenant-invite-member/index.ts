// M5 — tenant-level "invite teammate" feature. Tenant equivalent of
// supabase/functions/platform-create-tenant-with-user/index.ts, but for
// an EXISTING tenant's own owner/admin inviting a new employee, not
// Zeev onboarding a brand-new company.
//
// WHY THIS CAN'T BE A REGULAR SECURITY DEFINER SQL RPC: same reason as
// the Zeev flow — creating an auth.users row requires the Supabase Admin
// API (service_role key), which is deliberately not reachable from a
// plain Postgres function callable by the browser. The existing
// memberships_insert RLS policy (0001_poc_core.sql) already lets an
// owner/admin insert a tenant_memberships row, but only for a person who
// already has a profiles/auth.users row — it can't onboard someone truly
// new. This function does both steps.
//
// Authorization: re-checks is_tenant_admin(tenantId) itself, using the
// CALLER's own JWT (passed through the Authorization header) against a
// plain (anon-key) Supabase client — not just "reached this URL". Only
// after that passes does it switch to the service_role client.
//
// Deliberately does NOT insert into tenants/tenant_subscriptions — the
// tenant already exists. Also deliberately rejects role: 'owner' — an
// admin inviting a teammate should not be able to mint a second owner
// through this same everyday form; creating another owner stays a
// separate, more deliberate action.
//
// Deploy: `supabase functions deploy tenant-invite-member` (this repo
// has no supabase/config.toml — deploys go through the Supabase CLI
// directly against the project, not through the Vercel build like the
// rest of this app). Last time, the CLI 404'd with `status 'INACTIVE'`
// until a function was first deployed via the Dashboard's browser editor
// (Edge Functions → Open Editor) — expect to need that workaround again
// if this is deployed to a project where Edge Functions were never
// initialized.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["admin", "member", "viewer"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { tenantId, email, password, fullName, role } = await req.json();
    if (!tenantId || !email || !password) {
      return new Response(JSON.stringify({ error: "tenantId, email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetRole = role ?? "member";
    if (!ALLOWED_ROLES.includes(targetRole)) {
      return new Response(JSON.stringify({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller-scoped client (anon key + caller's JWT) — used ONLY to
    // verify is_tenant_admin(tenantId) as the actual calling user.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isTenantAdmin, error: adminCheckError } = await callerClient.rpc("is_tenant_admin", {
      p_tenant_id: tenantId,
    });
    if (adminCheckError || !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Insufficient permissions: tenant owner/admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // service_role client — only reachable inside this Edge Function,
    // never sent to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createUserError) {
      return new Response(JSON.stringify({ error: `Failed to create user: ${createUserError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newMemberId = createdUser.user.id;

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({ id: newMemberId, full_name: fullName ?? null }, { onConflict: "id" });
    if (profileError) {
      return new Response(JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: membershipError } = await adminClient
      .from("tenant_memberships")
      .insert({ tenant_id: tenantId, profile_id: newMemberId, role: targetRole });
    if (membershipError) {
      return new Response(JSON.stringify({ error: `Failed to create membership: ${membershipError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ tenantId, memberId: newMemberId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
