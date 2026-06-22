import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { ok, err, handleError } from '@/lib/api';
import { requireAuth } from '@/lib/auth-helpers';
import { getSession } from '@/lib/session';
import { ChangePasswordSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

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
      data: {
        password: await bcrypt.hash(newPassword, 12),
        sessionVersion: { increment: 1 },
      },
    });

    const session = await getSession();
    session.destroy();
    await session.save(); // Write cleared cookie back to the client

    return ok({ changed: true });
  } catch (error) {
    return handleError(error);
  }
}
