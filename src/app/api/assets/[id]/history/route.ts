import { NextRequest } from 'next/server';
import { ok, handleError, notFound } from '@/backend/lib/api';
import { requireAuth } from '@/backend/lib/auth-helpers';
import { AddHistorySchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

const STATUS_MAP: Record<string, string> = {
  'Active': 'ACTIVE',
  'Maintenance': 'MAINTENANCE',
  'Disposed': 'DISPOSED',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data = AddHistorySchema.parse(body);

    const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
    if (!asset) return notFound('Asset');

    await prisma.$transaction(async tx => {
      if (data.updateStatus && STATUS_MAP[data.updateStatus]) {
        await tx.asset.update({ where: { id }, data: { status: STATUS_MAP[data.updateStatus] as Parameters<typeof tx.asset.update>[0]['data']['status'] } });
      }
      await tx.assetHistory.create({
        data: {
          assetId: id,
          userId: user.id,
          action: data.action,
          details: data.details,
          type: data.type as Parameters<typeof tx.assetHistory.create>[0]['data']['type'],
        },
      });
    });

    return ok({ created: true });
  } catch (error) {
    return handleError(error);
  }
}
