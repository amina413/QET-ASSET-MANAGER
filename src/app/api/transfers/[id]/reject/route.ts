import { NextRequest } from 'next/server';
import { ok, err, handleError, notFound } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import prisma from '@/backend/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('approve_transfer');
    if (error) return error;

    const { id } = await params;
    const req_ = await prisma.transferRequest.findUnique({ where: { id } });
    if (!req_) return notFound('Transfer request');
    if (req_.status !== 'PENDING') return err('Transfer request is no longer pending', 409);

    await prisma.$transaction([
      prisma.asset.update({ where: { id: req_.assetId }, data: { status: 'ACTIVE' } }),
      prisma.transferRequest.update({
        where: { id },
        data: { status: 'REJECTED', approvedById: user.id, resolvedAt: new Date() },
      }),
    ]);

    return ok({ rejected: true });
  } catch (error) {
    return handleError(error);
  }
}
