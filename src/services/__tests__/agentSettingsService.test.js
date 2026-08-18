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

describe('AgentSettingsService', () => {
  let supabase;
  let AgentSettingsService;

  beforeEach(async () => {
    resetMockState();
    const clientModule = await import('@/lib/supabaseClient');
    supabase = clientModule.supabase;
    supabase.__setResult = (result) => { queuedResult = result; };
    supabase.__setUser = (user) => { queuedUser = user; };
    supabase.__getLastInsertPayload = () => lastInsertPayload;
    supabase.__getLastUpdatePayload = () => lastUpdatePayload;

    const serviceModule = await import('../agentSettingsService');
    AgentSettingsService = serviceModule.AgentSettingsService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 's1', minimum_profit_percent: 15 }], error: null });
      const result = await AgentSettingsService.list();
      expect(result).toEqual([{ id: 's1', minimum_profit_percent: 15 }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(AgentSettingsService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 's1', tenant_id: 'tenant-1' }, error: null });

      await AgentSettingsService.create({ minimum_profit_percent: 20 });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        minimum_profit_percent: 20,
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(AgentSettingsService.create({ minimum_profit_percent: 20 }))
        .rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 's1', minimum_profit_percent: 25 }, error: null });

      await AgentSettingsService.update('s1', {
        minimum_profit_percent: 25,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ minimum_profit_percent: 25 });
    });
  });

  it('does not expose delete — no delete UI exists for agent settings (see PHASE_8_IMPLEMENTATION_PLAN.md section 0)', () => {
    expect(AgentSettingsService.delete).toBeUndefined();
  });
});
