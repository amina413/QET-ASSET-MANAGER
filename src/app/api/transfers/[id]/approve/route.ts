import { NextRequest } from 'next/server';
import { ok, err, handleError, notFound } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import { ApproveTransferSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('approve_transfer');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { custodianId } = ApproveTransferSchema.parse(body);

    const req_ = await prisma.transferRequest.findUnique({ where: { id }, include: { asset: true } });
    if (!req_) return notFound('Transfer request');
    if (!req_.asset.isActive) return notFound('Asset');
    if (req_.status !== 'PENDING') return err('Transfer request is no longer pending', 409);
    if (req_.requestedById === user.id) return err('Transfer requests must be approved by a different user.', 403);
    if (req_.asset.status !== 'PENDING_TRANSFER') return err('Asset is not pending transfer', 409);
    if (req_.toCustodianId !== custodianId) {
      return err('Approved custodian must match the transfer request custodian', 422);
    }

    const custodian = await prisma.user.findUnique({ where: { id: custodianId }, select: { id: true, isActive: true } });
    if (!custodian || !custodian.isActive) return notFound('Custodian user');

    await prisma.$transaction(async tx => {
      const resolved = await tx.transferRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', approvedById: user.id, resolvedAt: new Date() },
      });
      if (resolved.count !== 1) throw new Error('TRANSFER_NOT_PENDING');

      const assetUpdated = await tx.asset.updateMany({
        where: { id: req_.assetId, status: 'PENDING_TRANSFER', isActive: true },
        data: { location: req_.toLocation, custodianId, status: 'ACTIVE' },
      });
      if (assetUpdated.count !== 1) throw new Error('ASSET_NOT_PENDING_TRANSFER');
      await tx.assetHistory.create({
        data: {
          assetId: req_.assetId,
          userId: user.id,
          action: 'Transfer Approved',
          details: `Transfer approved: ${req_.fromLocation} → ${req_.toLocation}. New custodian: ${req_.toCustodian}`,
          type: 'Transfer',
          fromLocation: req_.fromLocation,
          toLocation: req_.toLocation,
          toCustodian: req_.toCustodian,
        },
      });
    });

    return ok({ approved: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSFER_NOT_PENDING') {
      return err('Transfer request is no longer pending', 409);
    }
    if (error instanceof Error && error.message === 'ASSET_NOT_PENDING_TRANSFER') {
      return err('Asset is not pending transfer', 409);
    }
    return handleError(error);
  }
}
