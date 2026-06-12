import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requireAuth, requirePermission } from '@/lib/auth-helpers';
import { CreateUserSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, department: true, role: true, lastLogin: true, createdAt: true },
    });

    return ok(users);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('manage_users');
    if (error) return error;

    const body = await req.json();
    const data = CreateUserSchema.parse(body);

    const hashed = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        department: data.department,
        role: data.role as Parameters<typeof prisma.user.create>[0]['data']['role'],
      },
      select: { id: true, name: true, email: true, department: true, role: true, createdAt: true },
    });

    return ok(user, 201);
  } catch (error) {
    return handleError(error);
  }
}
