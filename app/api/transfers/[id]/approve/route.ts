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
    if (req_.status !== 'PENDING') return err('Transfer request is no longer pending', 409);

    await prisma.$transaction([
      prisma.asset.update({
        where: { id: req_.assetId },
        data: { location: req_.toLocation, custodianId, status: 'ACTIVE' },
      }),
      prisma.transferRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: user.id, resolvedAt: new Date() },
      }),
      prisma.assetHistory.create({
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
      }),
    ]);

    return ok({ approved: true });
  } catch (error) {
    return handleError(error);
  }
}
