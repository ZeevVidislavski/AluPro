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

describe('MaterialOrderService', () => {
  let supabase;
  let MaterialOrderService;

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

    const serviceModule = await import('../materialOrderService');
    MaterialOrderService = serviceModule.MaterialOrderService;
  });

  describe('listByProject', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'mo1', order_type: 'profiles' }], error: null });
      const result = await MaterialOrderService.listByProject('proj-1');
      expect(result).toEqual([{ id: 'mo1', order_type: 'profiles' }]);
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'mo1', tenant_id: 'tenant-1' }, error: null });

      await MaterialOrderService.create({ project_id: 'proj-1', order_type: 'profiles', status: 'draft' });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        project_id: 'proj-1',
        order_type: 'profiles',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 'mo1', status: 'sent' }, error: null });

      await MaterialOrderService.update('mo1', {
        status: 'sent',
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ status: 'sent' });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_material_order RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await MaterialOrderService.delete('mo1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_material_order');
      expect(rpcCall.args).toEqual({ order_id: 'mo1' });
    });
  });
});
