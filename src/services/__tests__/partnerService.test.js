import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same mocking approach as customerService.test.js/projectService.test.js.
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

describe('PartnerService', () => {
  let supabase;
  let PartnerService;

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

    const serviceModule = await import('../partnerService');
    PartnerService = serviceModule.PartnerService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'p1', name: 'Test Partner' }], error: null });
      const result = await PartnerService.list();
      expect(result).toEqual([{ id: 'p1', name: 'Test Partner' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(PartnerService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await PartnerService.create({ name: 'New Partner', profit_share_percent: 50 });
      } catch {
        // Same caveat as customerService.test.js/projectService.test.js.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        name: 'New Partner',
        profit_share_percent: 50,
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(
        PartnerService.create({ name: 'New Partner', profit_share_percent: 50 })
      ).rejects.toThrow('No active tenant membership found for this user');
    });

    it('throws if the user is not authenticated', async () => {
      supabase.__setUser({ data: { user: null }, error: null });

      await expect(
        PartnerService.create({ name: 'New Partner', profit_share_percent: 50 })
      ).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload before sending it', async () => {
      supabase.__setResult({ data: { id: 'p1', name: 'Updated' }, error: null });

      await PartnerService.update('p1', {
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
    it('calls the soft_delete_partner RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await PartnerService.delete('p1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_partner');
      expect(rpcCall.args).toEqual({ partner_id: 'p1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(PartnerService.delete('p1')).rejects.toThrow('permission denied');
    });
  });
});
