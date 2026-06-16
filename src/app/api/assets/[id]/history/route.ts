import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requireAssetAccess, requireAuth, requirePermission } from '@/backend/lib/auth-helpers';
import type { Permission } from '@/backend/lib/permissions';
import { AddHistorySchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

const STATUS_MAP: Record<string, string> = {
  'Active': 'ACTIVE',
  'Maintenance': 'MAINTENANCE',
  'Disposed': 'DISPOSED',
};

function permissionForHistory(type: string, updateStatus?: string): Permission | null {
  if (updateStatus) return 'change_asset_status';
  if (type === 'Audit') return 'record_audit';
  if (type === 'Issue') return null;
  return 'edit_asset';
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = AddHistorySchema.parse(body);
    const permission = permissionForHistory(data.type, data.updateStatus);
    const auth = permission ? await requirePermission(permission) : await requireAuth();
    if (auth.error) return auth.error;
    const { user } = auth;

    const { asset, error: assetError } = await requireAssetAccess(user, id);
    if (assetError) return assetError;

    await prisma.$transaction(async tx => {
      if (data.updateStatus && STATUS_MAP[data.updateStatus]) {
        await tx.asset.update({ where: { id: asset.id }, data: { status: STATUS_MAP[data.updateStatus] as Parameters<typeof tx.asset.update>[0]['data']['status'] } });
      }
      await tx.assetHistory.create({
        data: {
          assetId: asset.id,
          userId: user.id,
          action: data.action,
          details: data.details,
          type: data.type as Parameters<typeof tx.assetHistory.create>[0]['data']['type'],
        },
      });
    });

    return ok({ created: true });
  } catch (error) {
    return handleError(error);
  }
}
