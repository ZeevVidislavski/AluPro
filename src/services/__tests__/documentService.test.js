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

describe('DocumentService', () => {
  let supabase;
  let DocumentService;

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
    supabase.__getLastUploadCall = () => lastUploadCall;

    const serviceModule = await import('../documentService');
    DocumentService = serviceModule.DocumentService;
  });

  describe('listByProject', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'd1', name: 'Contract.pdf' }], error: null });
      const result = await DocumentService.listByProject('proj-1');
      expect(result).toEqual([{ id: 'd1', name: 'Contract.pdf' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(DocumentService.listByProject('proj-1')).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'd1', tenant_id: 'tenant-1' }, error: null });

      await DocumentService.create({ project_id: 'proj-1', document_type: 'contract', name: 'Contract', file_url: null });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        project_id: 'proj-1',
        name: 'Contract',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 'd1', name: 'Updated' }, error: null });

      await DocumentService.update('d1', {
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
    it('calls the soft_delete_document RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await DocumentService.delete('d1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_document');
      expect(rpcCall.args).toEqual({ document_id: 'd1' });
    });
  });

  describe('uploadFile', () => {
    it('uploads to the project-files bucket under a tenant/document-scoped path', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });

      const file = { name: 'Photo!.jpg' };
      const path = await DocumentService.uploadFile(file, 'doc-1');

      expect(path).toMatch(/^tenant-1\/documents\/doc-1\/\d+_photo_.jpg$/);
    });
  });

  describe('getFileUrl', () => {
    it('returns null when no path is given', async () => {
      const result = await DocumentService.getFileUrl(null);
      expect(result).toBeNull();
    });

    it('creates a signed URL', async () => {
      const url = await DocumentService.getFileUrl('tenant-1/documents/d1/1_file.pdf');
      expect(url).toBe('https://signed.example/url');
    });
  });
});
