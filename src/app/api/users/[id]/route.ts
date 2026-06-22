import { NextRequest } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { ok, err, handleError, notFound } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import { UpdateUserSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';
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

    // Prevent editing accounts of equal or higher rank (IDOR guard)
    const ROLE_RANK: Record<string, number> = { CUSTODIAN: 1, AUDITOR: 2, ASSET_MANAGER: 3, SYSTEM_ADMIN: 4 };
    const actorRank = ROLE_RANK[actor.role.toUpperCase().replace(' ', '_')] ?? 0;
    const targetRank = ROLE_RANK[existing.role] ?? 0;
    if (actor.role !== 'System Admin' && actorRank <= targetRank) {
      return err('You cannot edit a user with the same or higher role', 403);
    }
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
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
      updateData.sessionVersion = { increment: 1 };
    }

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

    // Cancel any pending transfers initiated by this user so they don't linger in the queue
    await prisma.transferRequest.updateMany({ where: { requestedById: id, status: 'PENDING' }, data: { status: 'REJECTED' } });
    // Soft delete: preserve the row so AssetHistory/AssetCustodian FKs stay intact.
    await prisma.user.update({ where: { id }, data: { isActive: false, sessionVersion: { increment: 1 } } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
