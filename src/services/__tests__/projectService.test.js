import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same mocking approach as customerService.test.js — see that file's
// header comment for why module-level state + vi.mock is used instead of
// vi.resetModules() (state leaked between tests with that approach).
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

describe('ProjectService', () => {
  let supabase;
  let ProjectService;

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

    const serviceModule = await import('../projectService');
    ProjectService = serviceModule.ProjectService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'p1', name: 'Test Project' }], error: null });
      const result = await ProjectService.list();
      expect(result).toEqual([{ id: 'p1', name: 'Test Project' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(ProjectService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await ProjectService.create({
          name: 'New Project',
          customer_id: 'customer-1',
          customer_name: 'Test Customer',
        });
      } catch {
        // Same caveat as customerService.test.js: the mock resolves both
        // the membership lookup .single() and the insert .single() with
        // the same queued shape, so create() may throw downstream — this
        // test only asserts on what was passed into .insert().
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        name: 'New Project',
        customer_id: 'customer-1',
        customer_name: 'Test Customer',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('strips any caller-supplied project_number — the DB sequence assigns it, not the client', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await ProjectService.create({
          name: 'New Project',
          customer_id: 'customer-1',
          customer_name: 'Test Customer',
          // Simulates a stale/malicious client trying to set its own
          // project_number, mirroring Base44's old client-side
          // `P${Date.now()...}` generation this migration removed.
          project_number: 'P999999',
        });
      } catch {
        // See note above.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).not.toHaveProperty('project_number');
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(
        ProjectService.create({ name: 'New Project', customer_id: 'customer-1', customer_name: 'X' })
      ).rejects.toThrow('No active tenant membership found for this user');
    });

    it('throws if the user is not authenticated', async () => {
      supabase.__setUser({ data: { user: null }, error: null });

      await expect(
        ProjectService.create({ name: 'New Project', customer_id: 'customer-1', customer_name: 'X' })
      ).rejects.toThrow();
    });

    it('coerces empty-string date fields to null (Postgres rejects "" for date columns)', async () => {
      // Regression test for a bug caught by manual browser testing, not
      // anticipated in the original plan: Base44's form leaves unfilled
      // date <input>s as "" rather than undefined, which Postgres date
      // columns reject with "invalid input syntax for type date".
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await ProjectService.create({
          name: 'New Project',
          customer_id: 'customer-1',
          customer_name: 'Test Customer',
          start_date: '',
          target_date: '',
        });
      } catch {
        // See note on the earlier tests in this file.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload.start_date).toBeNull();
      expect(insertPayload.target_date).toBeNull();
    });

    it('leaves a populated date field untouched', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      try {
        await ProjectService.create({
          name: 'New Project',
          customer_id: 'customer-1',
          customer_name: 'Test Customer',
          target_date: '2026-09-01',
        });
      } catch {
        // See note on the earlier tests in this file.
      }

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload.target_date).toBe('2026-09-01');
    });
  });

  describe('get', () => {
    it('returns a single project by id', async () => {
      supabase.__setResult({ data: { id: 'p1', name: 'Test Project' }, error: null });
      const result = await ProjectService.get('p1');
      expect(result).toEqual({ id: 'p1', name: 'Test Project' });
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, deleted_at, and project_number from the payload', async () => {
      supabase.__setResult({ data: { id: 'p1', name: 'Updated' }, error: null });

      await ProjectService.update('p1', {
        name: 'Updated',
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
        project_number: 'P999999',
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ name: 'Updated' });
    });
  });

  describe('closeSettlement', () => {
    it('sets settlement_status to closed and closed_by to the real authenticated user id, not a hardcoded string', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'p1', settlement_status: 'closed' }, error: null });

      await ProjectService.closeSettlement('p1');

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload.settlement_status).toBe('closed');
      expect(updatePayload.closed_by).toBe('user-1');
      expect(updatePayload.closed_at).toBeTruthy();
    });
  });

  describe('reopenSettlement', () => {
    it('resets settlement_status to open and clears closed_at/closed_by', async () => {
      supabase.__setResult({ data: { id: 'p1', settlement_status: 'open' }, error: null });

      await ProjectService.reopenSettlement('p1');

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ settlement_status: 'open', closed_at: null, closed_by: null });
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_project RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await ProjectService.delete('p1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_project');
      expect(rpcCall.args).toEqual({ project_id: 'p1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(ProjectService.delete('p1')).rejects.toThrow('permission denied');
    });
  });
});
