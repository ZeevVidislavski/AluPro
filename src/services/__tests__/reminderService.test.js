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

describe('ReminderService', () => {
  let supabase;
  let ReminderService;

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

    const serviceModule = await import('../reminderService');
    ReminderService = serviceModule.ReminderService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'r1', title: 'Test Reminder' }], error: null });
      const result = await ReminderService.list();
      expect(result).toEqual([{ id: 'r1', title: 'Test Reminder' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(ReminderService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await ReminderService.create({ title: 'New Reminder', due_date: '2026-09-01', priority: 'medium' });
      } catch {
        // Same caveat as other service tests: shared mock queuedResult
        // means create() may throw downstream — this test only checks
        // the insert payload.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        title: 'New Reminder',
        due_date: '2026-09-01',
        priority: 'medium',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('allows project_id to be omitted (nullable, unlike projects/client_payments)', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await ReminderService.create({ title: 'Standalone Reminder', due_date: '2026-09-01', priority: 'low' });
      } catch {
        // See note above.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).not.toHaveProperty('project_id');
    });

    it('coerces an empty-string due_date to null', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await ReminderService.create({ title: 'X', due_date: '', priority: 'medium' });
      } catch {
        // See note above.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload.due_date).toBeNull();
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(
        ReminderService.create({ title: 'X', due_date: '2026-09-01', priority: 'medium' })
      ).rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 'r1', status: 'done' }, error: null });

      await ReminderService.update('r1', {
        status: 'done',
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ status: 'done' });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_reminder RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await ReminderService.delete('r1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_reminder');
      expect(rpcCall.args).toEqual({ reminder_id: 'r1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(ReminderService.delete('r1')).rejects.toThrow('permission denied');
    });
  });
});
