import { NextRequest } from 'next/server';
import { LoginSchema } from '@/backend/lib/validation';
import { ok, err, handleError } from '@/backend/lib/api';
import { getSession, dbRoleToDisplay } from '@/backend/lib/session';
import prisma from '@/backend/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { checkRateLimit, isRateLimited } from '@/backend/lib/rate-limit';

const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY === 'true') {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);
    const key = email.toLowerCase();
    const ip = getClientIp(req);

    const isLockedOut = await isRateLimited({
      key: `login:${key}:${ip}`,
      limit: MAX_ATTEMPTS,
    });
    if (isLockedOut) {
      return err('Too many failed login attempts. Please try again in 15 minutes.', 429);
    }

    const user = await prisma.user.findUnique({
      where: { email: key },
      select: { id: true, name: true, email: true, department: true, role: true, lastLogin: true, password: true, isActive: true },
    });

    if (!user || !user.isActive) {
      await checkRateLimit({ key: `login:${key}:${ip}`, limit: MAX_ATTEMPTS, windowMs: LOCKOUT_MS });
      return err('Invalid credentials', 401);
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      await checkRateLimit({ key: `login:${key}:${ip}`, limit: MAX_ATTEMPTS, windowMs: LOCKOUT_MS });
      return err('Invalid credentials', 401);
    }

    const session = await getSession();
    session.destroy();
    session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: dbRoleToDisplay(user.role),
      lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
    };
    session.csrfToken = randomUUID();
    await session.save();

    // Non-critical bookkeeping — must not block or fail the login itself.
    prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      .catch(updateError => console.error('[login] failed to update lastLogin', updateError));

    const { password: _password, isActive: _isActive, ...userWithoutSecrets } = user;
    return ok({ ...userWithoutSecrets, role: dbRoleToDisplay(user.role) });
  } catch (error) {
    return handleError(error);
  }
}
