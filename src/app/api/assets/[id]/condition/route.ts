import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requireAssetAccess, requirePermission } from '@/backend/lib/auth-helpers';
import { UpdateAssetConditionSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('update_condition');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { conditionCode } = UpdateAssetConditionSchema.parse(body);

    const { asset, error: assetError } = await requireAssetAccess(user, id);
    if (assetError) return assetError;

    await prisma.$transaction([
      prisma.asset.update({ where: { id: asset.id }, data: { conditionCode } }),
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          userId: user.id,
          action: 'Condition Update',
          details: `Condition changed to ${conditionCode}`,
          type: 'Maintenance',
        },
      }),
    ]);

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
