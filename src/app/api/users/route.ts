import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { ok, err, handleError } from '@/backend/lib/api';
import { requireAuth, requirePermission } from '@/backend/lib/auth-helpers';
import { hasPermission } from '@/backend/lib/permissions';
import { CreateUserSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const canManageUsers = hasPermission(user.role, 'manage_users');

    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: canManageUsers
        ? { id: true, name: true, email: true, department: true, role: true, lastLogin: true, createdAt: true }
        : { id: true, name: true, department: true },
    });

    return ok(users);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user: actor, error } = await requirePermission('manage_users');
    if (error) return error;

    const body = await req.json();
    const data = CreateUserSchema.parse(body);

    if (data.role === 'SYSTEM_ADMIN' && actor.role !== 'System Admin') {
      return err('Only System Admins can create System Admin accounts', 403);
    }

    const hashed = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        department: data.department,
        role: data.role as Role,
      },
      select: { id: true, name: true, email: true, department: true, role: true, createdAt: true },
    });

    return ok(user, 201);
  } catch (error) {
    return handleError(error);
  }
}
