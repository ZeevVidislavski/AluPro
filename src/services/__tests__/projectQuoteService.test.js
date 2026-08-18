import { describe, it, expect, vi, beforeEach } from 'vitest';

let queuedResult = { data: null, error: null };
let queuedUser = { data: { user: { id: 'user-1' } }, error: null };
let queuedRpcResult = { data: null, error: null };
let queuedUploadResult = { data: { path: 'ignored' }, error: null };
let queuedSignedUrlResult = { data: { signedUrl: 'https://signed.example/url' }, error: null };
let lastInsertPayload = null;
let lastUpdatePayload = null;
let lastRpcCall = null;
let lastUploadCall = null;

function resetMockState() {
  queuedResult = { data: null, error: null };
  queuedUser = { data: { user: { id: 'user-1' } }, error: null };
  queuedRpcResult = { data: null, error: null };
  queuedUploadResult = { data: { path: 'ignored' }, error: null };
  queuedSignedUrlResult = { data: { signedUrl: 'https://signed.example/url' }, error: null };
  lastInsertPayload = null;
  lastUpdatePayload = null;
  lastRpcCall = null;
  lastUploadCall = null;
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

  const storageBucket = {
    upload: vi.fn((path, file) => {
      lastUploadCall = { path, file };
      return Promise.resolve(queuedUploadResult);
    }),
    createSignedUrl: vi.fn(() => Promise.resolve(queuedSignedUrlResult)),
  };

  const supabase = {
    from: vi.fn(() => builder),
    auth: { getUser: vi.fn(() => Promise.resolve(queuedUser)) },
    rpc: vi.fn((fnName, args) => {
      lastRpcCall = { fnName, args };
      return Promise.resolve(queuedRpcResult);
    }),
    storage: {
      from: vi.fn(() => storageBucket),
    },
  };

  return { supabase };
});

describe('ProjectQuoteService', () => {
  let supabase;
  let ProjectQuoteService;

  beforeEach(async () => {
    resetMockState();
    const clientModule = await import('@/lib/supabaseClient');
    supabase = clientModule.supabase;
    supabase.__setResult = (result) => { queuedResult = result; };
    supabase.__setUser = (user) => { queuedUser = user; };
    supabase.__setRpcResult = (result) => { queuedRpcResult = result; };
    supabase.__setUploadResult = (result) => { queuedUploadResult = result; };
    supabase.__setSignedUrlResult = (result) => { queuedSignedUrlResult = result; };
    supabase.__getLastInsertPayload = () => lastInsertPayload;
    supabase.__getLastUpdatePayload = () => lastUpdatePayload;
    supabase.__getLastRpcCall = () => lastRpcCall;
    supabase.__getLastUploadCall = () => lastUploadCall;

    const serviceModule = await import('../projectQuoteService');
    ProjectQuoteService = serviceModule.ProjectQuoteService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'q1', amount: 5000 }], error: null });
      const result = await ProjectQuoteService.list();
      expect(result).toEqual([{ id: 'q1', amount: 5000 }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(ProjectQuoteService.list()).rejects.toThrow('boom');
    });
  });

  describe('delete', () => {
    it('calls the soft_delete_project_quote RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await ProjectQuoteService.delete('q1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_project_quote');
      expect(rpcCall.args).toEqual({ quote_id: 'q1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(ProjectQuoteService.delete('q1')).rejects.toThrow('permission denied');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by — added in Phase 10 for ProjectDetails.jsx only, not Quotes.jsx', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      await ProjectQuoteService.create({ project_id: 'proj-1', addition_number: 0, amount: 15000 });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        project_id: 'proj-1',
        amount: 15000,
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 'q1', amount: 20000 }, error: null });

      await ProjectQuoteService.update('q1', {
        amount: 20000,
        tenant_id: 'attacker-tenant',
        created_by: 'attacker-user',
        deleted_at: null,
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload).toEqual({ amount: 20000 });
    });

    it('coerces empty-string quote_date/valid_until to null (Postgres rejects "" for date columns)', async () => {
      // Regression test for a bug caught by manual browser testing:
      // QuoteEditor.jsx's valid_until date input left unset renders as
      // "" rather than undefined.
      supabase.__setResult({ data: { id: 'q1' }, error: null });

      await ProjectQuoteService.update('q1', {
        quote_date: '',
        valid_until: '',
      });

      const updatePayload = supabase.__getLastUpdatePayload();
      expect(updatePayload.quote_date).toBeNull();
      expect(updatePayload.valid_until).toBeNull();
    });
  });

  describe('uploadFile', () => {
    it('uploads to the project-files bucket under a tenant/quote-scoped path and returns the path', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      const file = { name: 'Quote File!.pdf' };
      const path = await ProjectQuoteService.uploadFile(file, 'quote-1');

      expect(path).toMatch(/^tenant-1\/project-quotes\/quote-1\/\d+_quote_file_.pdf$/);
      const uploadCall = supabase.__getLastUploadCall();
      expect(uploadCall.path).toBe(path);
    });
  });

  describe('getFileUrl', () => {
    it('returns null when no path is given', async () => {
      const result = await ProjectQuoteService.getFileUrl(null);
      expect(result).toBeNull();
    });

    it('creates a signed URL', async () => {
      const url = await ProjectQuoteService.getFileUrl('tenant-1/project-quotes/q1/1_file.pdf');
      expect(url).toBe('https://signed.example/url');
    });
  });
});
