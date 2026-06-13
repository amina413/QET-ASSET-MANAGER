import { NextRequest } from 'next/server';
import { ok, err, handleError, notFound } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import { UpdateDepartmentSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const data = UpdateDepartmentSchema.parse(await req.json());

    const existing = await prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('Department');

    try {
      const department = await prisma.department.update({ where: { id }, data });
      return ok(department);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        return err('A department with that name or code already exists', 409);
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

    const existing = await prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('Department');

    await prisma.department.update({ where: { id }, data: { isActive: false } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
