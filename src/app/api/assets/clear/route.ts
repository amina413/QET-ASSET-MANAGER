import { ok, handleError } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import prisma from '@/backend/lib/prisma';

export async function DELETE() {
  try {
    const { error } = await requirePermission('system_settings');
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
