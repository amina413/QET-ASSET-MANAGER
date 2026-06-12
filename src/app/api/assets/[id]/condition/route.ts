import { NextRequest } from 'next/server';
import { ok, handleError, notFound } from '@/backend/lib/api';
import { requireAuth } from '@/backend/lib/auth-helpers';
import { UpdateAssetConditionSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { conditionCode } = UpdateAssetConditionSchema.parse(body);

    const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!asset) return notFound('Asset');

    await prisma.$transaction([
      prisma.asset.update({ where: { id }, data: { conditionCode } }),
      prisma.assetHistory.create({
        data: {
          assetId: id,
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
