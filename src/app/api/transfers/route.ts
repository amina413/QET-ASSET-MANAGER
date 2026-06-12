import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requireAuth, requirePermission } from '@/backend/lib/auth-helpers';
import { InitiateTransferSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const transfers = await prisma.transferRequest.findMany({
      where: { status: 'PENDING' },
      include: { asset: { include: { custodian: { select: { id: true, name: true } } } } },
      orderBy: { requestedAt: 'desc' },
    });

    return ok(transfers);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission('initiate_transfer');
    if (error) return error;

    const body = await req.json();
    const data = InitiateTransferSchema.parse(body);

    const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
    if (!asset) return handleError(new Error('Asset not found'));

    await prisma.$transaction([
      prisma.transferRequest.create({
        data: {
          assetId: data.assetId,
          fromLocation: asset.location,
          toLocation: data.toLocation,
          toCustodian: data.toCustodian,
          toCustodianId: data.toCustodianId,
          requestedById: user.id,
          status: 'PENDING',
        },
      }),
      prisma.asset.update({ where: { id: data.assetId }, data: { status: 'PENDING_TRANSFER' } }),
    ]);

    return ok({ initiated: true }, 201);
  } catch (error) {
    return handleError(error);
  }
}
