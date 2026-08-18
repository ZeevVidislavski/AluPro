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

describe('QuoteItemComponentService', () => {
  let supabase;
  let QuoteItemComponentService;

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

    const serviceModule = await import('../quoteItemComponentService');
    QuoteItemComponentService = serviceModule.QuoteItemComponentService;
  });

  describe('listByQuoteItem', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'c1', name_snapshot: 'Profile A' }], error: null });
      const result = await QuoteItemComponentService.listByQuoteItem('item-1');
      expect(result).toEqual([{ id: 'c1', name_snapshot: 'Profile A' }]);
    });
  });

  describe('listByQuoteItems', () => {
    it('fetches each item separately and flattens the results, preserving the existing Promise.all shape', async () => {
      supabase.__setResult({ data: [{ id: 'c1' }], error: null });
      const result = await QuoteItemComponentService.listByQuoteItems(['item-1', 'item-2']);
      expect(result).toEqual([{ id: 'c1' }, { id: 'c1' }]);
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'c1', tenant_id: 'tenant-1' }, error: null });

      await QuoteItemComponentService.create({
        quote_item_id: 'item-1',
        name_snapshot: 'Profile A',
        pricing_method_snapshot: 'sqm',
        price_snapshot: 100,
      });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        quote_item_id: 'item-1',
        name_snapshot: 'Profile A',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, deleted_at, and quote_item_id from the payload', async () => {
      supabase.__setResult({ data: { id: 'c1', price_snapshot: 120 }, error: null });

      await QuoteItemComponentService.update('c1', {
        price_snapshot: 120,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
        quote_item_id: 'attacker-item',
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ price_snapshot: 120 });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_quote_item_component RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await QuoteItemComponentService.delete('c1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_quote_item_component');
      expect(rpcCall.args).toEqual({ component_id: 'c1' });
    });
  });
});
