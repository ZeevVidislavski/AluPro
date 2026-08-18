import { describe, it, expect, vi, beforeEach } from 'vitest';

let queuedResult = { data: null, error: null };
let queuedUser = { data: { user: { id: 'user-1' } }, error: null };
let queuedRpcResult = { data: null, error: null };
let queuedUploadResult = { data: { path: 'uploaded/path' }, error: null };
let queuedSignedUrlResult = { data: { signedUrl: 'https://signed.example/url' }, error: null };
let lastInsertPayload = null;
let lastUpdatePayload = null;
let lastRpcCall = null;
let lastUploadCall = null;
let lastSignedUrlCall = null;

function resetMockState() {
  queuedResult = { data: null, error: null };
  queuedUser = { data: { user: { id: 'user-1' } }, error: null };
  queuedRpcResult = { data: null, error: null };
  queuedUploadResult = { data: { path: 'uploaded/path' }, error: null };
  queuedSignedUrlResult = { data: { signedUrl: 'https://signed.example/url' }, error: null };
  lastInsertPayload = null;
  lastUpdatePayload = null;
  lastRpcCall = null;
  lastUploadCall = null;
  lastSignedUrlCall = null;
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
    createSignedUrl: vi.fn((path, ttl) => {
      lastSignedUrlCall = { path, ttl };
      return Promise.resolve(queuedSignedUrlResult);
    }),
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

describe('CompanyHeaderService', () => {
  let supabase;
  let CompanyHeaderService;

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
    supabase.__getLastSignedUrlCall = () => lastSignedUrlCall;

    const serviceModule = await import('../companyHeaderService');
    CompanyHeaderService = serviceModule.CompanyHeaderService;
  });

  describe('list', () => {
    it('returns data on success', async () => {
      supabase.__setResult({ data: [{ id: 'h1', name: 'Main' }], error: null });
      const result = await CompanyHeaderService.list();
      expect(result).toEqual([{ id: 'h1', name: 'Main' }]);
    });

    it('throws when the query returns an error', async () => {
      supabase.__setResult({ data: null, error: new Error('boom') });
      await expect(CompanyHeaderService.list()).rejects.toThrow('boom');
    });
  });

  describe('create', () => {
    it('injects tenant_id and created_by from the active membership', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { id: 'h1', tenant_id: 'tenant-1' }, error: null });

      await CompanyHeaderService.create({ name: 'Main' });

      const insertPayload = supabase.__getLastInsertPayload();
      expect(insertPayload).toMatchObject({
        name: 'Main',
        tenant_id: 'tenant-1',
        created_by: 'user-1',
      });
    });

    it('throws if no active tenant membership is found', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: null, error: null });

      await expect(CompanyHeaderService.create({ name: 'X' }))
        .rejects.toThrow('No active tenant membership found for this user');
    });
  });

  describe('update', () => {
    it('strips tenant_id, created_by, and deleted_at from the payload', async () => {
      supabase.__setResult({ data: { id: 'h1', name: 'Updated' }, error: null });

      await CompanyHeaderService.update('h1', {
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
    it('calls the soft_delete_company_header RPC, not a direct table update', async () => {
      supabase.__setRpcResult({ data: null, error: null });

      await CompanyHeaderService.delete('h1');

      const rpcCall = supabase.__getLastRpcCall();
      expect(rpcCall.fnName).toBe('soft_delete_company_header');
      expect(rpcCall.args).toEqual({ header_id: 'h1' });
    });

    it('throws when the RPC returns an error', async () => {
      supabase.__setRpcResult({ data: null, error: new Error('permission denied') });
      await expect(CompanyHeaderService.delete('h1')).rejects.toThrow('permission denied');
    });
  });

  describe('setDefault', () => {
    it('updates every header, setting is_default only on the chosen one', async () => {
      supabase.__setResult({ data: [
        { id: 'h1', is_default: true },
        { id: 'h2', is_default: false },
        { id: 'h3', is_default: false },
      ], error: null });

      const updateSpy = vi.spyOn(CompanyHeaderService, 'update').mockResolvedValue({});

      await CompanyHeaderService.setDefault('h2');

      expect(updateSpy).toHaveBeenCalledWith('h1', { is_default: false });
      expect(updateSpy).toHaveBeenCalledWith('h2', { is_default: true });
      expect(updateSpy).toHaveBeenCalledWith('h3', { is_default: false });

      updateSpy.mockRestore();
    });
  });

  describe('uploadLogo', () => {
    it('uploads to the company-logos bucket under a tenant/header-scoped path and returns the path', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });
      supabase.__setUploadResult({ data: { path: 'ignored' }, error: null });

      const file = { name: 'Logo File!.png' };
      const path = await CompanyHeaderService.uploadLogo(file, 'header-1');

      expect(path).toMatch(/^tenant-1\/company-headers\/header-1\/\d+_logo_file_.png$/);

      const uploadCall = supabase.__getLastUploadCall();
      expect(uploadCall.path).toBe(path);
      expect(uploadCall.file).toBe(file);
    });

    it('throws when the upload returns an error', async () => {
      supabase.__setUser({ data: { user: { id: 'user-1' } }, error: null });
      supabase.__setResult({ data: { tenant_id: 'tenant-1' }, error: null });
      supabase.__setUploadResult({ data: null, error: new Error('storage denied') });

      await expect(CompanyHeaderService.uploadLogo({ name: 'a.png' }, 'header-1'))
        .rejects.toThrow('storage denied');
    });
  });

  describe('getLogoUrl', () => {
    it('returns null when no path is given', async () => {
      const result = await CompanyHeaderService.getLogoUrl(null);
      expect(result).toBeNull();
    });

    it('creates a signed URL with the configured TTL', async () => {
      supabase.__setSignedUrlResult({ data: { signedUrl: 'https://signed.example/url' }, error: null });

      const url = await CompanyHeaderService.getLogoUrl('tenant-1/company-headers/h1/1_logo.png');

      expect(url).toBe('https://signed.example/url');
      const signedUrlCall = supabase.__getLastSignedUrlCall();
      expect(signedUrlCall.path).toBe('tenant-1/company-headers/h1/1_logo.png');
      expect(signedUrlCall.ttl).toBe(3600);
    });

    it('throws when signed URL creation returns an error', async () => {
      supabase.__setSignedUrlResult({ data: null, error: new Error('not found') });
      await expect(CompanyHeaderService.getLogoUrl('some/path')).rejects.toThrow('not found');
    });
  });
});
