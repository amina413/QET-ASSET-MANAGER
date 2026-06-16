import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { ok, err, handleError } from '@/backend/lib/api';
import { requireAuth } from '@/backend/lib/auth-helpers';
import { getSession } from '@/backend/lib/session';
import { ChangePasswordSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(body);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true, isActive: true },
    });
    if (!dbUser || !dbUser.isActive) return err('Invalid session', 401);

    const valid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!valid) return err('Current password is incorrect', 401);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 12) },
    });

    const session = await getSession();
    session.destroy();

    return ok({ changed: true });
  } catch (error) {
    return handleError(error);
  }
}
