import { NextRequest } from 'next/server';
import { LoginSchema } from '@/lib/validation';
import { ok, err, handleError } from '@/lib/api';
import { getSession, dbRoleToDisplay } from '@/lib/session';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { checkRateLimit, isRateLimited } from '@/lib/rate-limit';

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

    // Check both per-email (distributed attack) and per-email+IP rate limits
    const [emailLocked, ipLocked] = await Promise.all([
      isRateLimited({ key: `login:${key}`, limit: MAX_ATTEMPTS * 2 }),
      isRateLimited({ key: `login:${key}:${ip}`, limit: MAX_ATTEMPTS }),
    ]);
    if (emailLocked || ipLocked) {
      return new Response(JSON.stringify({ success: false, error: 'Too many failed login attempts. Please try again in 15 minutes.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '900' },
      });
    }

    // Increment counters BEFORE DB lookup so failed attempts register from attempt 1
    const incrementCounters = async () => {
      await Promise.all([
        checkRateLimit({ key: `login:${key}`, limit: MAX_ATTEMPTS * 2, windowMs: LOCKOUT_MS }),
        checkRateLimit({ key: `login:${key}:${ip}`, limit: MAX_ATTEMPTS, windowMs: LOCKOUT_MS }),
      ]);
    };

    const user = await prisma.user.findUnique({
      where: { email: key },
      select: { id: true, name: true, email: true, department: true, role: true, lastLogin: true, password: true, isActive: true, sessionVersion: true },
    });

    if (!user || !user.isActive) {
      await incrementCounters();
      return err('Invalid credentials', 401);
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      await incrementCounters();
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
      sessionVersion: user.sessionVersion,
    };
    session.csrfToken = randomUUID();
    await session.save();

    // Non-critical bookkeeping — must not block or fail the login itself.
    const loginTime = new Date().toISOString();
    prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      .catch(updateError => console.error('[login] failed to update lastLogin', updateError));

    const { password: _password, isActive: _isActive, sessionVersion: _sessionVersion, lastLogin: _lastLogin, ...userWithoutSecrets } = user;
    // Use loginTime (current timestamp) rather than the stale DB lastLogin value
    return ok({ ...userWithoutSecrets, role: dbRoleToDisplay(user.role), lastLogin: loginTime });
  } catch (error) {
    return handleError(error);
  }
}
