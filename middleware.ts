import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { AppSession } from '@/lib/session';
import { sessionOptions } from '@/lib/session';

const PUBLIC_PATHS = ['/api/auth/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Only protect /api routes — page routes are protected client-side
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<AppSession>(req, res, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
