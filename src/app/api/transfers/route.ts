import { NextRequest } from 'next/server';
import { ok, err, handleError, notFound } from '@/lib/api';
import { requireAssetAccess, requireAuth, requirePermission } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/permissions';
import { InitiateTransferSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';
import type { Prisma, TransferStatus } from '@prisma/client';

const VALID_STATUSES: TransferStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const take = Math.min(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 200);
    const skip = Math.max(parseInt(searchParams.get('skip') ?? '0', 10) || 0, 0);

    let where: Prisma.TransferRequestWhereInput = { status: 'PENDING', asset: { isActive: true } };
    if (status === 'all') {
      where = { asset: { isActive: true } };
    } else if (status && (VALID_STATUSES as string[]).includes(status)) {
      where = { status: status as TransferStatus, asset: { isActive: true } };
    }

    if (!hasPermission(user.role, 'approve_transfer')) {
      where = {
        ...where,
        OR: [
          { requestedById: user.id },
          { asset: { isActive: true, custodianId: user.id } },
        ],
      };
    }

    const transfers = await prisma.transferRequest.findMany({
      where,
      include: { asset: { include: { custodian: { select: { id: true, name: true } } } } },
      orderBy: { requestedAt: 'desc' },
      take,
      skip,
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

    const { asset, error: assetError } = await requireAssetAccess<{
      id: string;
      custodianId: string;
      isActive: boolean;
      location: string;
      status: string;
    }>(user, data.assetId, {
      id: true,
      custodianId: true,
      isActive: true,
      location: true,
      status: true,
    });
    if (assetError) return assetError;

    if (asset.status === 'PENDING_TRANSFER') {
      return err('This asset already has a pending transfer request', 409);
    }

    const targetCustodian = await prisma.user.findUnique({
      where: { id: data.toCustodianId },
      select: { id: true, isActive: true },
    });
    if (!targetCustodian?.isActive) return notFound('Custodian user');

    await prisma.$transaction(async tx => {
      const claimed = await tx.asset.updateMany({
        where: {
          id: asset.id,
          isActive: true,
          status: { not: 'PENDING_TRANSFER' },
        },
        data: { status: 'PENDING_TRANSFER' },
      });

      if (claimed.count !== 1) {
        throw new Error('TRANSFER_ALREADY_PENDING');
      }

      await tx.transferRequest.create({
        data: {
          assetId: asset.id,
          fromLocation: asset.location,
          toLocation: data.toLocation,
          toCustodian: data.toCustodian,
          toCustodianId: data.toCustodianId,
          requestedById: user.id,
          status: 'PENDING',
        },
      });
    });

    return ok({ initiated: true }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSFER_ALREADY_PENDING') {
      return err('This asset already has a pending transfer request', 409);
    }
    return handleError(error);
  }
}
