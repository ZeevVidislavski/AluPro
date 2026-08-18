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

describe('QuoteTemplateComponentService', () => {
  let supabase;
  let QuoteTemplateComponentService;

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

    const serviceModule = await import('../quoteTemplateComponentService');
    QuoteTemplateComponentService = serviceModule.QuoteTemplateComponentService;
  });

  describe('listByTemplate', () => {
    it('filters by template_id and returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'c1', template_id: 't1' }], error: null });
      const result = await QuoteTemplateComponentService.listByTemplate('t1');
      expect(result).toEqual([{ id: 'c1', template_id: 't1' }]);
      expect(supabase.__getLastEqCall()).toEqual({ col: 'template_id', val: 't1' });
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(QuoteTemplateComponentService.listByTemplate('t1')).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by, preserving the snapshot fields as given', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'c1', tenant_id: 'tenant-1' }, error: null });

      await QuoteTemplateComponentService.create({
        template_id: 't1',
        catalog_item_id: 'm1',
        name_snapshot: 'Window 9000',
        pricing_method_snapshot: 'sqm',
        price_snapshot: 1200,
        sort_order: 0,
      });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        template_id: 't1',
        name_snapshot: 'Window 9000',
        pricing_method_snapshot: 'sqm',
        price_snapshot: 1200,
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(QuoteTemplateComponentService.create({ template_id: 't1', name_snapshot: 'X', pricing_method_snapshot: 'sqm', price_snapshot: 1 }))
        .rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, deleted_at, and template_id from the payload', async () => {
      supabase.__setResult({ data: { id: 'c1', price_snapshot: 1500 }, error: null });

      await QuoteTemplateComponentService.update('c1', {
        price_snapshot: 1500,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
        template_id: 'attacker-template',
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ price_snapshot: 1500 });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_quote_template_component RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await QuoteTemplateComponentService.delete('c1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_quote_template_component');
      expect(rpcCall.args).toEqual({ component_id: 'c1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(QuoteTemplateComponentService.delete('c1')).rejects.toThrow('permission denied');
    });
  });
});
