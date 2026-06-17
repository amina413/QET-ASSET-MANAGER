import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const prisma = {
    asset: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    assetHistory: {
      create: vi.fn(),
    },
    transferRequest: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };

  return {
    prisma,
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
    requireAssetAccess: vi.fn(),
    createAssetImageUploadUrl: vi.fn(),
    isManagedAssetImageUrl: vi.fn(),
    checkRateLimit: vi.fn(),
    isRateLimited: vi.fn(),
    getSession: vi.fn(),
    bcrypt: {
      compare: vi.fn(),
      hash: vi.fn(),
    },
  };
});

vi.mock('@/backend/lib/prisma', () => ({ default: mocks.prisma }));
vi.mock('@/backend/lib/auth-helpers', () => ({
  requireAuth: mocks.requireAuth,
  requirePermission: mocks.requirePermission,
  requireAssetAccess: mocks.requireAssetAccess,
}));
vi.mock('@/backend/lib/asset-image-storage', () => ({
  createAssetImageUploadUrl: mocks.createAssetImageUploadUrl,
  isManagedAssetImageUrl: mocks.isManagedAssetImageUrl,
}));
vi.mock('@/backend/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  isRateLimited: mocks.isRateLimited,
}));
vi.mock('@/backend/lib/session', () => ({
  getSession: mocks.getSession,
  dbRoleToDisplay: (role: string) => ({
    SYSTEM_ADMIN: 'System Admin',
    ASSET_MANAGER: 'Asset Manager',
    CUSTODIAN: 'Custodian',
    AUDITOR: 'Auditor',
  })[role] ?? 'Custodian',
}));
vi.mock('bcryptjs', () => ({ default: mocks.bcrypt }));

import { GET as getAsset, DELETE as deleteAsset } from '@/app/api/assets/[id]/route';
import { PUT as putAssetImage } from '@/app/api/assets/[id]/image/route';
import { POST as createUploadUrl } from '@/app/api/assets/[id]/image/upload-url/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as changePassword } from '@/app/api/auth/change-password/route';
import { GET as ready } from '@/app/api/health/ready/route';
import { POST as approveTransfer } from '@/app/api/transfers/[id]/approve/route';
import { DELETE as deleteUser } from '@/app/api/users/[id]/route';

const actor = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  department: 'IT',
  role: 'Custodian' as const,
  lastLogin: null,
};

function request(method: string, url: string, body?: unknown, headers?: HeadersInit): NextRequest {
  return new Request(url, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function payload(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('security-critical API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') return input(mocks.prisma);
      return Promise.all(input as Promise<unknown>[]);
    });
  });

  it('hides single-asset history from roles without audit-log permission', async () => {
    mocks.requireAuth.mockResolvedValue({ user: actor, error: null });
    mocks.prisma.asset.findFirst.mockResolvedValue({
      id: 'asset-1',
      custodianId: actor.id,
      name: 'Laptop',
      history: [{ id: 'history-1' }],
    });

    const result = await payload(await getAsset(request('GET', 'http://test.local/api/assets/asset-1'), {
      params: Promise.resolve({ id: 'asset-1' }),
    }));

    expect(result.status).toBe(200);
    expect(result.body.data.history).toEqual([]);
    expect(mocks.prisma.asset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ custodianId: actor.id, isActive: true }),
      include: expect.not.objectContaining({ history: expect.anything() }),
    }));
  });

  it('does not count successful logins toward lockout', async () => {
    const session = { destroy: vi.fn(), save: vi.fn() };
    mocks.isRateLimited.mockResolvedValue(false);
    mocks.getSession.mockResolvedValue(session);
    mocks.bcrypt.compare.mockResolvedValue(true);
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Admin',
      email: 'admin@example.com',
      department: 'IT',
      role: 'SYSTEM_ADMIN',
      lastLogin: null,
      password: 'hash',
      isActive: true,
    });
    mocks.prisma.user.update.mockResolvedValue({});

    const result = await payload(await login(request('POST', 'http://test.local/api/auth/login', {
      email: 'admin@example.com',
      password: 'correct-password',
    }, { 'x-real-ip': '127.0.0.1' })));

    expect(result.status).toBe(200);
    expect(mocks.isRateLimited).toHaveBeenCalledOnce();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(session.destroy).toHaveBeenCalledOnce();
    expect(session.save).toHaveBeenCalledOnce();
  });

  it('counts failed logins toward lockout', async () => {
    mocks.isRateLimited.mockResolvedValue(false);
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

    const result = await payload(await login(request('POST', 'http://test.local/api/auth/login', {
      email: 'missing@example.com',
      password: 'wrong-password',
    }, { 'x-real-ip': '127.0.0.1' })));

    expect(result.status).toBe(401);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      key: 'login:missing@example.com:127.0.0.1',
    }));
  });

  it('destroys the current session after password change', async () => {
    const session = { destroy: vi.fn() };
    mocks.requireAuth.mockResolvedValue({ user: actor, error: null });
    mocks.getSession.mockResolvedValue(session);
    mocks.bcrypt.compare.mockResolvedValue(true);
    mocks.bcrypt.hash.mockResolvedValue('new-hash');
    mocks.prisma.user.findUnique.mockResolvedValue({ id: actor.id, password: 'old-hash', isActive: true });
    mocks.prisma.user.update.mockResolvedValue({});

    const result = await payload(await changePassword(request('POST', 'http://test.local/api/auth/change-password', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    })));

    expect(result.status).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: actor.id },
      data: { password: 'new-hash' },
    }));
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it('fails readiness closed unless the health token is configured and supplied', async () => {
    let result = await payload(await ready(request('GET', 'http://test.local/api/health/ready')));
    expect(result.status).toBe(401);
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();

    vi.stubEnv('HEALTH_CHECK_TOKEN', 'secret-health-token');
    mocks.prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    result = await payload(await ready(request('GET', 'http://test.local/api/health/ready', undefined, {
      'x-health-token': 'secret-health-token',
    })));

    expect(result.status).toBe(200);
    expect(result.body.data.database).toBe('ok');
  });

  it('rejects stale transfer approvals with a conflict', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { ...actor, role: 'Asset Manager' }, error: null });
    mocks.prisma.transferRequest.findUnique.mockResolvedValue({
      id: 'transfer-1',
      assetId: 'asset-1',
      fromLocation: 'Old',
      toLocation: 'New',
      toCustodian: 'New Custodian',
      toCustodianId: 'user-2',
      status: 'PENDING',
      asset: { isActive: true },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'user-2', isActive: true });
    mocks.prisma.transferRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await payload(await approveTransfer(request('POST', 'http://test.local/api/transfers/transfer-1/approve', {
      custodianId: 'user-2',
    }), { params: Promise.resolve({ id: 'transfer-1' }) }));

    expect(result.status).toBe(409);
    expect(mocks.prisma.transferRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'transfer-1', status: 'PENDING' },
    }));
    expect(mocks.prisma.asset.update).not.toHaveBeenCalled();
  });

  it('rejects unmanaged asset image URLs before touching the asset', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { ...actor, role: 'Asset Manager' }, error: null });
    mocks.isManagedAssetImageUrl.mockReturnValue(false);

    const result = await payload(await putAssetImage(request('PUT', 'http://test.local/api/assets/asset-1/image', {
      imageUrl: 'https://example.com/unmanaged.png',
    }), { params: Promise.resolve({ id: 'asset-1' }) }));

    expect(result.status).toBe(422);
    expect(mocks.requireAssetAccess).not.toHaveBeenCalled();
  });

  it('creates upload URLs only after permission and asset access checks', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { ...actor, role: 'Asset Manager' }, error: null });
    mocks.requireAssetAccess.mockResolvedValue({ asset: { id: 'asset-1', custodianId: actor.id, isActive: true }, error: null });
    mocks.createAssetImageUploadUrl.mockResolvedValue({
      uploadUrl: 'https://storage.example.com/upload',
      publicUrl: 'https://assets.example.com/asset-1.png',
    });

    const result = await payload(await createUploadUrl(request('POST', 'http://test.local/api/assets/asset-1/image/upload-url', {
      fileName: 'asset.png',
      contentType: 'image/png',
      contentLength: 1024,
    }), { params: Promise.resolve({ id: 'asset-1' }) }));

    expect(result.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith('edit_asset');
    expect(mocks.requireAssetAccess).toHaveBeenCalledWith(expect.any(Object), 'asset-1');
    expect(mocks.createAssetImageUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-1' }));
  });

  it('soft-deletes assets instead of removing their rows', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { ...actor, role: 'Asset Manager' }, error: null });
    mocks.prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', isActive: true });
    mocks.prisma.asset.update.mockResolvedValue({});
    mocks.prisma.assetHistory.create.mockResolvedValue({});

    const result = await payload(await deleteAsset(request('DELETE', 'http://test.local/api/assets/asset-1'), {
      params: Promise.resolve({ id: 'asset-1' }),
    }));

    expect(result.status).toBe(200);
    expect(mocks.prisma.asset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { isActive: false, status: 'DISPOSED' },
    });
  });

  it('blocks user deactivation while active assets are assigned', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { ...actor, role: 'System Admin' }, error: null });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    mocks.prisma.asset.count.mockResolvedValue(2);

    const result = await payload(await deleteUser(request('DELETE', 'http://test.local/api/users/user-2'), {
      params: Promise.resolve({ id: 'user-2' }),
    }));

    expect(result.status).toBe(409);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
});
