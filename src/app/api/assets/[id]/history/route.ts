import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requireAssetAccess, requireAuth, requirePermission } from '@/lib/auth-helpers';
import type { Permission } from '@/lib/permissions';
import { AddHistorySchema } from '@/lib/validation';
import { STATUS_MAP_REVERSE } from '@/lib/asset-constants';
import prisma from '@/lib/prisma';

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
      if (data.updateStatus && STATUS_MAP_REVERSE[data.updateStatus]) {
        const newStatus = STATUS_MAP_REVERSE[data.updateStatus] as Parameters<typeof tx.asset.update>[0]['data']['status'];
        await tx.asset.update({
          where: { id: asset.id },
          data: {
            status: newStatus,
            // Disposing via history must also deactivate the asset to stay consistent
            // with the soft-delete behaviour in assets/[id]/route.ts DELETE
            ...(data.updateStatus === 'Disposed' ? { isActive: false } : {}),
          },
        });
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
