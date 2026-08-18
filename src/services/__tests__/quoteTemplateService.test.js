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

describe('QuoteTemplateService', () => {
  let supabase;
  let QuoteTemplateService;

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

    const serviceModule = await import('../quoteTemplateService');
    QuoteTemplateService = serviceModule.QuoteTemplateService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 't1', name: 'Standard Window Set' }], error: null });
      const result = await QuoteTemplateService.list();
      expect(result).toEqual([{ id: 't1', name: 'Standard Window Set' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(QuoteTemplateService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 't1', tenant_id: 'tenant-1' }, error: null });

      await QuoteTemplateService.create({ name: 'Standard Window Set' });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        name: 'Standard Window Set',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(QuoteTemplateService.create({ name: 'X' }))
        .rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 't1', name: 'Updated' }, error: null });

      await QuoteTemplateService.update('t1', {
        name: 'Updated',
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ name: 'Updated' });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_quote_template RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await QuoteTemplateService.delete('t1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_quote_template');
      expect(rpcCall.args).toEqual({ template_id: 't1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(QuoteTemplateService.delete('t1')).rejects.toThrow('permission denied');
    });
  });
});
