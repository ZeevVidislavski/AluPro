import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client module before importing CustomerService, so no
// real network/env vars are needed. This is a unit test of CustomerService
// logic (which fields get injected/stripped, RPC vs direct UPDATE usage),
// not an integration test against a real Supabase project — see
// docs/PHASE_1_IMPLEMENTATION_PLAN.md section 5 for the distinction and
// why the RLS tenant-isolation contract test still needs a real project.
//
// The mock state lives in module-level `let` bindings (not inside the
// factory closure) so `resetMockState()` can clear it between tests
// without needing vi.resetModules() — that approach was tried first and
// leaked state between tests because the mock factory wasn't being
// re-invoked on every import as expected.
let queuedResult = { data: null, error: null };
let queuedUser = { data: { user: { id: 'user-1' } }, error: null };
let lastInsertPayload = null;
let lastUpdatePayload = null;
let lastRpcCall = null;

function resetMockState() {
  queuedResult = { data: null, error: null };
  queuedUser = { data: { user: { id: 'user-1' } }, error: null };
  lastInsertPayload = null;
  lastUpdatePayload = null;
  lastRpcCall = null;
}

vi.mock('@/lib/supabaseClient', () => {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((payload) => { lastInsertPayload = payload; return builder; }),
    update: vi.fn((payload) => { lastUpdatePayload = payload; return builder; }),
    single: vi.fn(() => Promise.resolve(queuedResult)),
    // list()/get() await the builder itself (no .single()) in some paths —
    // make the builder thenable so `await excludeDeleted(...)` resolves.
    then: (resolve) => resolve(queuedResult),
  };

  const supabase = {
    from: vi.fn(() => builder),
    auth: { getUser: vi.fn(() => Promise.resolve(queuedUser)) },
    rpc: vi.fn((fnName, args) => {
      lastRpcCall = { fnName, args };
      return Promise.resolve(queuedResult);
    }),
  };

  return { supabase };
});

describe('CustomerService', () => {
  let supabase;
  let CustomerService;

  beforeEach(async () => {
    resetMockState();
    const clientModule = await import('@/lib/supabaseClient');
    supabase = clientModule.supabase;
    // Expose the module-level state getters/setters as methods on the
    // imported supabase mock, for readability at call sites below.
    supabase.__setResult = (result) => { queuedResult = result; };
    supabase.__setUser = (user) => { queuedUser = user; };
    supabase.__getLastInsertPayload = () => lastInsertPayload;
    supabase.__getLastUpdatePayload = () => lastUpdatePayload;
    supabase.__getLastRpcCall = () => lastRpcCall;

    const serviceModule = await import('../customerService');
    CustomerService = serviceModule.CustomerService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'c1', name: 'Test' }], error: null });
      const result = await CustomerService.list();
      expect(result).toEqual([{ id: 'c1', name: 'Test' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(CustomerService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership, not from caller input', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      // First .single() call resolves the tenant_id lookup; second resolves the insert.
      // Since our mock builder shares one queued result, set it to the
      // membership lookup shape first, call create, and assert on the
      // insert payload captured before the final .single() resolves.
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      // customerService.create() does: getUser -> getActiveTenantId (single()
      // call #1) -> insert(...).select().single() (call #2). Our mock
      // resolves both .single() calls with the same queued result, so we
      // can't distinguish them by return value alone — but we CAN assert
      // on what was passed into .insert(), which is the actual behavior
      // under test here (does create() inject tenant_id/created_by).
      try {
        await CustomerService.create({ name: 'New Customer', phone: '0500000000' });
      } catch {
        // The second .single() call resolving to a membership-shaped
        // object instead of a customer row means CustomerService.create()
        // may throw downstream (e.g. if it read created.id) — irrelevant
        // to what this test checks.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        name: 'New Customer',
        phone: '0500000000',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(
        CustomerService.create({ name: 'New Customer', phone: '0500000000' })
      ).rejects.toThrow('No active tenant membership found for this user');
    });

    it('throws if the user is not authenticated', async () => {
      supabase.__setUser({ data: { user: null }, error: null });

      await expect(
        CustomerService.create({ name: 'New Customer', phone: '0500000000' })
      ).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload before sending it', async () => {
      supabase.__setResult({ data: { id: 'c1', name: 'Updated' }, error: null });

      await CustomerService.update('c1', {
        name: 'Updated',
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ name: 'Updated' });
      expect(updatePayload).not.toHaveProperty('tenant_id');
      expect(updatePayload).not.toHaveProperty('created_by');
      expect(updatePayload).not.toHaveProperty('deleted_at');
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_customer RPC, not a direct table update', async () => {
      supabase.__setResult({ data: null, error: null });

      await CustomerService.delete('c1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_customer');
      expect(rpcCall.args).toEqual({ customer_id: 'c1' });
      // Critically: .update() on the customers table must NOT have been
      // called by delete() — this is the exact bug class the RPC-based
      // approach was designed to prevent (see SUPABASE_SCHEMA_PLAN.md 6.3).
      expect(supabase.__getLastUpdatePayload()).toBeNull();
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('permission denied') });
      await expect(CustomerService.delete('c1')).rejects.toThrow('permission denied');
    });
  });

  describe('restore', () => {
    it('calls the restore_customer RPC', async () => {
      supabase.__setResult({ data: null, error: null });

      await CustomerService.restore('c1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('restore_customer');
      expect(rpcCall.args).toEqual({ customer_id: 'c1' });
    });
  });
});
