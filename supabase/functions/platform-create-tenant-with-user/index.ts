// Super-admin console, milestone M2 (part 2/2): creates a brand-new auth
// user AND a tenant AND the owner membership in one call, so Zeev never
// has to open the Supabase dashboard to onboard a client.
//
// WHY THIS CAN'T BE A REGULAR SECURITY DEFINER SQL FUNCTION (unlike
// platform_create_tenant / platform_set_tenant_status in
// 0019_platform_create_tenant.sql): creating an auth.users row requires
// the Supabase Admin API (service_role key), which is deliberately NOT
// exposed to plain Postgres functions callable from the browser — only
// server-side code holding the service_role key can call it. An Edge
// Function is Supabase's supported place to hold that key safely (it
// runs on Supabase's servers, never shipped to the client).
//
// Authorization: this function re-checks is_platform_admin() itself,
// using the CALLER's own JWT (passed through in the Authorization
// header) against a plain (anon-key) Supabase client — it does NOT trust
// the request just because it reached this URL. Only after that check
// passes does it switch to the service_role client to actually create
// the user.
//
// Deploy: `supabase functions deploy platform-create-tenant-with-user`
// (this repo has no supabase/config.toml — deploys go through the
// Supabase CLI directly against the project, not through the Vercel
// build like the rest of this app).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Caller-scoped client (anon key + caller's JWT) — used ONLY to
    // verify is_platform_admin() as the actual calling user, exactly the
    // same check every other platform_* RPC performs.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isAdmin, error: adminCheckError } = await callerClient.rpc("is_platform_admin");
    if (adminCheckError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Insufficient permissions: platform admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, slug, ownerEmail, ownerPassword, ownerFullName } = await req.json();
    if (!name || !slug || !ownerEmail || !ownerPassword) {
      return new Response(JSON.stringify({ error: "name, slug, ownerEmail and ownerPassword are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // service_role client — only reachable inside this Edge Function,
    // never sent to the browser. Used for the two things that need
    // elevated privilege: creating the auth user, and the tenant/
    // membership inserts (bypassing RLS the same way the SQL RPCs do via
    // SECURITY DEFINER, since this function's own authorization check
    // above already stands in for that).
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });
    if (createUserError) {
      return new Response(JSON.stringify({ error: `Failed to create user: ${createUserError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerId = createdUser.user.id;

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({ id: ownerId, full_name: ownerFullName ?? null }, { onConflict: "id" });
    if (profileError) {
      return new Response(JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .insert({ name, slug })
      .select("id")
      .single();
    if (tenantError) {
      return new Response(JSON.stringify({ error: `Failed to create tenant: ${tenantError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: membershipError } = await adminClient
      .from("tenant_memberships")
      .insert({ tenant_id: tenant.id, profile_id: ownerId, role: "owner" });
    if (membershipError) {
      return new Response(JSON.stringify({ error: `Failed to create membership: ${membershipError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: subscriptionError } = await adminClient
      .from("tenant_subscriptions")
      .insert({ tenant_id: tenant.id });
    if (subscriptionError) {
      return new Response(JSON.stringify({ error: `Failed to create subscription row: ${subscriptionError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ tenantId: tenant.id, ownerId }), {
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
