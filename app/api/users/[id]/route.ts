import { NextRequest } from 'next/server';
import { ok, handleError, notFound } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import { UpdateUserSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('edit_users');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data = UpdateUserSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('User');

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.department) updateData.department = data.department;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, department: true, role: true },
    });

    return ok(user);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('delete_users');
    if (error) return error;

    const { id } = await params;
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('User');

    await prisma.user.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
