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

describe('QuoteItemService', () => {
  let supabase;
  let QuoteItemService;

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

    const serviceModule = await import('../quoteItemService');
    QuoteItemService = serviceModule.QuoteItemService;
  });

  describe('listByQuote', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'qi1', width_cm: 100 }], error: null });
      const result = await QuoteItemService.listByQuote('quote-1');
      expect(result).toEqual([{ id: 'qi1', width_cm: 100 }]);
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'qi1', tenant_id: 'tenant-1' }, error: null });

      await QuoteItemService.create({ quote_id: 'quote-1', width_cm: 100, height_cm: 150, quantity: 1 });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        quote_id: 'quote-1',
        width_cm: 100,
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, deleted_at, and quote_id from the payload', async () => {
      supabase.__setResult({ data: { id: 'qi1', width_cm: 120 }, error: null });

      await QuoteItemService.update('qi1', {
        width_cm: 120,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
        quote_id: 'attacker-quote',
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ width_cm: 120 });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_quote_item RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await QuoteItemService.delete('qi1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_quote_item');
      expect(rpcCall.args).toEqual({ item_id: 'qi1' });
    });
  });
});
