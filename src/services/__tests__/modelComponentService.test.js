import { describe, it, expect, vi, beforeEach } from 'vitest';

let queuedResult = { data: null, error: null };
let queuedUser = { data: { user: { id: 'user-1' } }, error: null };
let queuedRpcResult = { data: null, error: null };
let lastInsertPayload = null;
let lastUpdatePayload = null;
let lastEqCall = null;
let lastRpcCall = null;

function resetMockState() {
  queuedResult = { data: null, error: null };
  queuedUser = { data: { user: { id: 'user-1' } }, error: null };
  queuedRpcResult = { data: null, error: null };
  lastInsertPayload = null;
  lastUpdatePayload = null;
  lastEqCall = null;
  lastRpcCall = null;
}

vi.mock('@/lib/supabaseClient', () => {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn((col, val) => { lastEqCall = { col, val }; return builder; }),
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

describe('ModelComponentService', () => {
  let supabase;
  let ModelComponentService;

  beforeEach(async () => {
    resetMockState();
    const clientModule = await import('@/lib/supabaseClient');
    supabase = clientModule.supabase;
    supabase.__setResult = (result) => { queuedResult = result; };
    supabase.__setUser = (user) => { queuedUser = user; };
    supabase.__setRpcResult = (result) => { queuedRpcResult = result; };
    supabase.__getLastInsertPayload = () => lastInsertPayload;
    supabase.__getLastUpdatePayload = () => lastUpdatePayload;
    supabase.__getLastEqCall = () => lastEqCall;
    supabase.__getLastRpcCall = () => lastRpcCall;

    const serviceModule = await import('../modelComponentService');
    ModelComponentService = serviceModule.ModelComponentService;
  });

  describe('listByModel', () => {
    it('filters by model_id and returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'c1', model_id: 'm1' }], error: null });
      const result = await ModelComponentService.listByModel('m1');
      expect(result).toEqual([{ id: 'c1', model_id: 'm1' }]);
      expect(supabase.__getLastEqCall()).toEqual({ col: 'model_id', val: 'm1' });
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(ModelComponentService.listByModel('m1')).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects model_id, tenant_id, and created_by', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'c1', tenant_id: 'tenant-1' }, error: null });

      await ModelComponentService.create('m1', { component_type: 'profile', item_code: 'P100', quantity: 2 });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        component_type: 'profile',
        item_code: 'P100',
        quantity: 2,
        model_id: 'm1',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(ModelComponentService.create('m1', { component_type: 'profile' }))
        .rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, deleted_at, and model_id from the payload', async () => {
      supabase.__setResult({ data: { id: 'c1', quantity: 3 }, error: null });

      await ModelComponentService.update('c1', {
        quantity: 3,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
        model_id: 'attacker-model',
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ quantity: 3 });
    });
  });

  describe('updateMany', () => {
    it('updates every component with its own data', async () => {
      supabase.__setResult({ data: { id: 'c1' }, error: null });

      const updateSpy = vi.spyOn(ModelComponentService, 'update').mockResolvedValue({});

      await ModelComponentService.updateMany([
        { id: 'c1', data: { calculated_length: 100 } },
        { id: 'c2', data: { calculated_length: 200 } },
      ]);

      expect(updateSpy).toHaveBeenCalledWith('c1', { calculated_length: 100 });
      expect(updateSpy).toHaveBeenCalledWith('c2', { calculated_length: 200 });

      updateSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_model_component RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await ModelComponentService.delete('c1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_model_component');
      expect(rpcCall.args).toEqual({ component_id: 'c1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(ModelComponentService.delete('c1')).rejects.toThrow('permission denied');
    });
  });
});
