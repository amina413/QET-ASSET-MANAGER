import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { AppSession } from '@/lib/session';
import { getSessionOptions } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';

const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/csrf', '/api/health', '/api/health/live', '/api/health/ready']);
const HEALTH_PATHS = new Set(['/api/health', '/api/health/live', '/api/health/ready']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

const RATE_LIMIT = 60;         // requests
const RATE_WINDOW_MS = 60_000; // per 60 seconds

function getClientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY === 'true') {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-real-ip')
      // WARNING: clients without a recognized IP header share the 'unknown' rate-limit
      // bucket, meaning one bad actor can exhaust the quota for all of them.
      // Ensure your reverse proxy always forwards X-Forwarded-For.
      ?? 'unknown';
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (!HEALTH_PATHS.has(pathname)) {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({
      key: `api:${ip}`,
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<AppSession>(req, res, getSessionOptions());

  if (!session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (MUTATING_METHODS.has(req.method)) {
    const headerToken = req.headers.get('x-csrf-token');
    // String equality is intentional: the CSRF token is already sent to the browser in
    // the response body (not a server-only secret), so timing-safe comparison adds no
    // security benefit here — the attacker can obtain the token via an authenticated GET.
    if (!headerToken || !session.csrfToken || headerToken !== session.csrfToken) {
      return NextResponse.json({ success: false, error: 'Invalid or missing CSRF token' }, { status: 403 });
    }
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
