import { NextRequest } from 'next/server';
import { ok, err, handleError, notFound } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import { UpdateLocationSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const data = UpdateLocationSchema.parse(await req.json());

    const existing = await prisma.location.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('Location');

    try {
      const location = await prisma.location.update({ where: { id }, data });
      return ok(location);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        return err('A location with that name or code already exists', 409);
      }
      throw e;
    }
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;

    const existing = await prisma.location.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('Location');

    await prisma.location.update({ where: { id }, data: { isActive: false } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
