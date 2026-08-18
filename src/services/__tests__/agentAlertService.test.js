import { describe, it, expect, vi, beforeEach } from 'vitest';

let queuedResult = { data: null, error: null };
let queuedUser = { data: { user: { id: 'user-1' } }, error: null };
let lastInsertPayload = null;
let lastUpdatePayload = null;

function resetMockState() {
  queuedResult = { data: null, error: null };
  queuedUser = { data: { user: { id: 'user-1' } }, error: null };
  lastInsertPayload = null;
  lastUpdatePayload = null;
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
  };

  return { supabase };
});

describe('AgentAlertService', () => {
  let supabase;
  let AgentAlertService;

  beforeEach(async () => {
    resetMockState();
    const clientModule = await import('@/lib/supabaseClient');
    supabase = clientModule.supabase;
    supabase.__setResult = (result) => { queuedResult = result; };
    supabase.__setUser = (user) => { queuedUser = user; };
    supabase.__getLastInsertPayload = () => lastInsertPayload;
    supabase.__getLastUpdatePayload = () => lastUpdatePayload;

    const serviceModule = await import('../agentAlertService');
    AgentAlertService = serviceModule.AgentAlertService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'a1', alert_type: 'cash_flow' }], error: null });
      const result = await AgentAlertService.list();
      expect(result).toEqual([{ id: 'a1', alert_type: 'cash_flow' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(AgentAlertService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'a1', tenant_id: 'tenant-1' }, error: null });

      await AgentAlertService.create({
        alert_key: 'p1|profitability',
        alert_type: 'profitability',
        severity: 'high',
        message: 'Low profit margin',
      });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        alert_key: 'p1|profitability',
        alert_type: 'profitability',
        severity: 'high',
        message: 'Low profit margin',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('allows project_id to be omitted (nullable, for global alerts like workload)', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'a1', tenant_id: 'tenant-1' }, error: null });

      await AgentAlertService.create({
        alert_key: 'global|workload',
        alert_type: 'workload',
        severity: 'medium',
        message: 'Too many open projects',
      });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).not.toHaveProperty('project_id');
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(AgentAlertService.create({ alert_key: 'x', alert_type: 'workload', severity: 'low', message: 'X' }))
        .rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 'a1', is_handled: true }, error: null });

      await AgentAlertService.update('a1', {
        is_handled: true,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ is_handled: true });
    });
  });

  it('does not expose delete — alerts are marked is_handled, never removed (see PHASE_8_IMPLEMENTATION_PLAN.md section 1.5)', () => {
    expect(AgentAlertService.delete).toBeUndefined();
  });
});
