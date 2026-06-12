import { NextRequest } from 'next/server';
import { LoginSchema } from '@/backend/lib/validation';
import { ok, err, handleError } from '@/backend/lib/api';
import { getSession, dbRoleToDisplay } from '@/backend/lib/session';
import prisma from '@/backend/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true, department: true, role: true, lastLogin: true, password: true },
    });

    if (!user) {
      return err('Invalid credentials', 401);
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return err('Invalid credentials', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const session = await getSession();
    session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: dbRoleToDisplay(user.role),
    };
    await session.save();

    const { password: _, ...userWithoutPassword } = user;
    return ok({ ...userWithoutPassword, role: dbRoleToDisplay(user.role) });
  } catch (error) {
    return handleError(error);
  }
}
