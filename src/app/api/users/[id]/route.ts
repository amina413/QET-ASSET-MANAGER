import { NextRequest } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { ok, err, handleError, notFound } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import { UpdateUserSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user: actor, error } = await requirePermission('edit_users');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data = UpdateUserSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!existing) return notFound('User');

    if (existing.role === 'SYSTEM_ADMIN' && actor.role !== 'System Admin') {
      return err('Only System Admins can edit System Admin accounts', 403);
    }
    if (data.role === 'SYSTEM_ADMIN' && actor.role !== 'System Admin') {
      return err('Only System Admins can assign the System Admin role', 403);
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.department) updateData.department = data.department;
    if (data.role) updateData.role = data.role as Role;
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
    const { user: actor, error } = await requirePermission('delete_users');
    if (error) return error;

    const { id } = await params;
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound('User');

    if (id === actor.id) {
      return err('You cannot deactivate your own account', 400);
    }

    const activeAssetCount = await prisma.asset.count({ where: { custodianId: id, isActive: true } });
    if (activeAssetCount > 0) {
      return err(`Reassign ${activeAssetCount} active asset(s) before deactivating this user.`, 409);
    }

    // Soft delete: preserve the row so AssetHistory/AssetCustodian FKs stay intact.
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
