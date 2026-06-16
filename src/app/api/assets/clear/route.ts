import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import prisma from '@/backend/lib/prisma';

const REQUIRED_CONFIRMATION = 'CLEAR ASSETS';

export async function DELETE(req: NextRequest) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;

    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ASSET_CLEAR !== 'true') {
      return err('Clearing all assets is disabled in production.', 403);
    }

    const body = await req.json().catch(() => null) as { confirmation?: string } | null;
    if (body?.confirmation !== REQUIRED_CONFIRMATION) {
      return err(`Type "${REQUIRED_CONFIRMATION}" to confirm this destructive action.`, 422);
    }

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
