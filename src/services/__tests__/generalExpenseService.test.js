import { describe, it, expect, vi, beforeEach } from 'vitest';

let queuedResult = { data: null, error: null };
let queuedUser = { data: { user: { id: 'user-1' } }, error: null };
let queuedRpcResult = { data: null, error: null };
let lastInsertPayload = null;
let lastUpdatePayload = null;
let lastRpcCall = null;

function resetMockState() {
  queuedResult = { data: null, error: null };
  queuedUser = { data: { user: { id: 'user-1' } }, error: null };
  queuedRpcResult = { data: null, error: null };
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
    then: (resolve) => resolve(queuedResult),
  };

  const supabase = {
    from: vi.fn(() => builder),
    auth: { getUser: vi.fn(() => Promise.resolve(queuedUser)) },
    rpc: vi.fn((fnName, args) => {
      lastRpcCall = { fnName, args };
      return Promise.resolve(queuedRpcResult);
    }),
  };

  return { supabase };
});

describe('GeneralExpenseService', () => {
  let supabase;
  let GeneralExpenseService;

  beforeEach(async () => {
    resetMockState();
    const clientModule = await import('@/lib/supabaseClient');
    supabase = clientModule.supabase;
    supabase.__setResult = (result) => { queuedResult = result; };
    supabase.__setUser = (user) => { queuedUser = user; };
    supabase.__setRpcResult = (result) => { queuedRpcResult = result; };
    supabase.__getLastInsertPayload = () => lastInsertPayload;
    supabase.__getLastUpdatePayload = () => lastUpdatePayload;
    supabase.__getLastRpcCall = () => lastRpcCall;

    const serviceModule = await import('../generalExpenseService');
    GeneralExpenseService = serviceModule.GeneralExpenseService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'e1', description: 'Rent' }], error: null });
      const result = await GeneralExpenseService.list();
      expect(result).toEqual([{ id: 'e1', description: 'Rent' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(GeneralExpenseService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'e1', tenant_id: 'tenant-1' }, error: null });

      await GeneralExpenseService.create({ description: 'Rent', category: 'rent', amount: 5000, expense_date: '2026-08-01' });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        description: 'Rent',
        category: 'rent',
        amount: 5000,
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(GeneralExpenseService.create({ description: 'X', amount: 1, expense_date: '2026-08-01' }))
        .rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 'e1', amount: 6000 }, error: null });

      await GeneralExpenseService.update('e1', {
        amount: 6000,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ amount: 6000 });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_general_expense RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await GeneralExpenseService.delete('e1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_general_expense');
      expect(rpcCall.args).toEqual({ expense_id: 'e1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(GeneralExpenseService.delete('e1')).rejects.toThrow('permission denied');
    });
  });
});
