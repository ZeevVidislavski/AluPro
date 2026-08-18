import { describe, it, expect, vi, beforeEach } from 'vitest';

let queuedResult = { data: null, error: null };
let queuedUser = { data: { user: { id: 'user-1' } }, error: null };
let queuedRpcResult = { data: null, error: null };
let lastInsertPayload = null;
let lastRpcCall = null;

function resetMockState() {
  queuedResult = { data: null, error: null };
  queuedUser = { data: { user: { id: 'user-1' } }, error: null };
  queuedRpcResult = { data: null, error: null };
  lastInsertPayload = null;
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

describe('MaterialOrderItemService', () => {
  let supabase;
  let MaterialOrderItemService;

  beforeEach(async () => {
    resetMockState();
    const clientModule = await import('@/lib/supabaseClient');
    supabase = clientModule.supabase;
    supabase.__setResult = (result) => { queuedResult = result; };
    supabase.__setUser = (user) => { queuedUser = user; };
    supabase.__setRpcResult = (result) => { queuedRpcResult = result; };
    supabase.__getLastInsertPayload = () => lastInsertPayload;
    supabase.__getLastRpcCall = () => lastRpcCall;

    const serviceModule = await import('../materialOrderItemService');
    MaterialOrderItemService = serviceModule.MaterialOrderItemService;
  });

  describe('listByOrder', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'i1', item_code: 'P100' }], error: null });
      const result = await MaterialOrderItemService.listByOrder('order-1');
      expect(result).toEqual([{ id: 'i1', item_code: 'P100' }]);
    });
  });

  describe('listByOrders', () => {
    it('fetches each order separately and flattens the results', async () => {
      supabase.__setResult({ data: [{ id: 'i1' }], error: null });
      const result = await MaterialOrderItemService.listByOrders(['order-1', 'order-2']);
      expect(result).toEqual([{ id: 'i1' }, { id: 'i1' }]);
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'i1', tenant_id: 'tenant-1' }, error: null });

      await MaterialOrderItemService.create({ material_order_id: 'order-1', item_code: 'P100', total_quantity: 5 });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        material_order_id: 'order-1',
        item_code: 'P100',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_material_order_item RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await MaterialOrderItemService.delete('i1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_material_order_item');
      expect(rpcCall.args).toEqual({ item_id: 'i1' });
    });
  });
});
