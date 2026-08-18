import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// This is an INTEGRATION test, not a unit test — it needs a real Supabase
// project (the AluPro one set up for Phase 1) and two real test users with
// separate tenant memberships. It is the single most important test in
// this PoC per docs/PHASE_1_IMPLEMENTATION_PLAN.md section 2/5: it proves
// tenant isolation actually works, not just that the code compiles.
//
// It is SKIPPED by default (describe.skipIf) unless the following env
// vars are present, so `npm test` stays fast and offline for everyday
// unit-test runs:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//   TEST_TENANT_A_EMAIL, TEST_TENANT_A_PASSWORD
//   TEST_TENANT_B_EMAIL, TEST_TENANT_B_PASSWORD
// (TENANT_A and TENANT_B must be users belonging to two DIFFERENT
// tenants — not yet true of the current seed, which only has one tenant.
// See "Not yet runnable" note at the bottom of this file.)

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const tenantAEmail = process.env.TEST_TENANT_A_EMAIL;
const tenantAPassword = process.env.TEST_TENANT_A_PASSWORD;
const tenantBEmail = process.env.TEST_TENANT_B_EMAIL;
const tenantBPassword = process.env.TEST_TENANT_B_PASSWORD;

const hasCredentials = Boolean(
  supabaseUrl && supabaseAnonKey && tenantAEmail && tenantAPassword && tenantBEmail && tenantBPassword
);

describe.skipIf(!hasCredentials)('RLS tenant isolation (integration)', () => {
  let clientA;
  let clientB;
  let createdCustomerIdA;

  beforeAll(async () => {
    clientA = createClient(supabaseUrl, supabaseAnonKey);
    clientB = createClient(supabaseUrl, supabaseAnonKey);

    const { error: errA } = await clientA.auth.signInWithPassword({
      email: tenantAEmail,
      password: tenantAPassword,
    });
    if (errA) throw errA;

    const { error: errB } = await clientB.auth.signInWithPassword({
      email: tenantBEmail,
      password: tenantBPassword,
    });
    if (errB) throw errB;
  });

  it('user A can create a customer in their own tenant', async () => {
    const { data: userA } = await clientA.auth.getUser();
    const { data: membershipA } = await clientA
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('profile_id', userA.user.id)
      .is('deleted_at', null)
      .limit(1)
      .single();

    const { data: created, error } = await clientA
      .from('customers')
      .insert({
        name: 'RLS Test Customer A',
        customer_type: 'private',
        phone: '0500000001',
        tenant_id: membershipA.tenant_id,
        created_by: userA.user.id,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(created).toBeTruthy();
    createdCustomerIdA = created.id;
  });

  it('user B cannot see the customer created by user A (different tenant)', async () => {
    const { data, error } = await clientB
      .from('customers')
      .select('*')
      .eq('id', createdCustomerIdA);

    // RLS should make this row simply not appear — not an error, an
    // empty result set. This is the core assertion of the whole PoC.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user B cannot update the customer created by user A', async () => {
    const { error } = await clientB
      .from('customers')
      .update({ name: 'Hijacked' })
      .eq('id', createdCustomerIdA);

    // The RLS UPDATE policy filters by tenant membership in its USING
    // clause, so the row simply won't match for user B — Postgres reports
    // this as a successful no-op update (0 rows affected), not an error.
    // Confirm no error AND confirm the row is unchanged when read back
    // by user A.
    expect(error).toBeNull();

    const { data: unchanged } = await clientA
      .from('customers')
      .select('name')
      .eq('id', createdCustomerIdA)
      .single();
    expect(unchanged.name).toBe('RLS Test Customer A');
  });
});

// =====================================================================
// NOT YET RUNNABLE: the current seed (supabase/seed/0005_fix_membership_
// owner.sql) only created ONE tenant ("AluPro Demo") with BOTH test users
// as owners of the SAME tenant — see memory/bug_no_active_tenant_
// membership.md. This test file assumes two users in two DIFFERENT
// tenants, which does not exist yet. To actually run this test:
//   1. Create a second tenant + a second real Supabase Auth user
//      belonging ONLY to that second tenant (not the AluPro one).
//   2. Set the env vars listed above (e.g. in .env.test, not committed).
//   3. Run: npm test -- rls.test.js
// This is flagged here rather than silently assumed working — the test
// is written and correct, but its precondition data doesn't exist yet.
// =====================================================================
