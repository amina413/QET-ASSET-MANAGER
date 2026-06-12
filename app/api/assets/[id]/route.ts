import { NextRequest } from 'next/server';
import { ok, handleError, notFound } from '@/lib/api';
import { requireAuth } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        custodian: { select: { id: true, name: true } },
        history: { include: { user: { select: { name: true } } }, orderBy: { date: 'desc' } },
        improvements: true,
        schedules: { orderBy: { fiscalYear: 'asc' } },
      },
    });

    if (!asset) return notFound('Asset');
    return ok(asset);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const existing = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('Asset');

    await prisma.asset.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
