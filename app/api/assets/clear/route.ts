import { ok, handleError } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function DELETE() {
  try {
    const { error } = await requirePermission('delete_asset');
    if (error) return error;

    await prisma.$transaction([
      prisma.depreciationSchedule.deleteMany({}),
      prisma.assetHistory.deleteMany({}),
      prisma.assetImprovement.deleteMany({}),
      prisma.transferRequest.deleteMany({}),
      prisma.asset.deleteMany({}),
    ]);

    return ok({ cleared: true });
  } catch (error) {
    return handleError(error);
  }
}
