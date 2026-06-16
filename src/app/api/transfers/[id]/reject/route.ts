import { NextRequest } from 'next/server';
import { ok, err, handleError, notFound } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import prisma from '@/backend/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('approve_transfer');
    if (error) return error;

    const { id } = await params;
    const req_ = await prisma.transferRequest.findUnique({ where: { id }, include: { asset: true } });
    if (!req_) return notFound('Transfer request');
    if (!req_.asset.isActive) return notFound('Asset');
    if (req_.status !== 'PENDING') return err('Transfer request is no longer pending', 409);

    await prisma.$transaction(async tx => {
      const resolved = await tx.transferRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', approvedById: user.id, resolvedAt: new Date() },
      });
      if (resolved.count !== 1) throw new Error('TRANSFER_NOT_PENDING');

      await tx.asset.update({ where: { id: req_.assetId }, data: { status: 'ACTIVE' } });
      await tx.assetHistory.create({
        data: {
          assetId: req_.assetId,
          userId: user.id,
          action: 'Transfer Rejected',
          details: `Transfer request from ${req_.fromLocation} to ${req_.toLocation} was rejected.`,
          type: 'Transfer',
          fromLocation: req_.fromLocation,
          toLocation: req_.toLocation,
        },
      });
    });

    return ok({ rejected: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSFER_NOT_PENDING') {
      return err('Transfer request is no longer pending', 409);
    }
    return handleError(error);
  }
}
