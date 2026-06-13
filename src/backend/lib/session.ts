import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'System Admin' | 'Asset Manager' | 'Custodian' | 'Auditor';
};

export type AppSession = {
  user?: SessionUser;
};

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET env var must be set to at least 32 characters. Add it to your .env file.');
}

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: 'qet_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
  },
};

export async function getSession(): Promise<IronSession<AppSession>> {
  const cookieStore = await cookies();
  return getIronSession<AppSession>(cookieStore, sessionOptions);
}

export async function getSessionFromRequest(
  req: NextRequest,
  res: NextResponse,
): Promise<IronSession<AppSession>> {
  return getIronSession<AppSession>(req, res, sessionOptions);
}

const ROLE_MAP: Record<string, SessionUser['role']> = {
  SYSTEM_ADMIN: 'System Admin',
  ASSET_MANAGER: 'Asset Manager',
  CUSTODIAN: 'Custodian',
  AUDITOR: 'Auditor',
};

export function dbRoleToDisplay(dbRole: string): SessionUser['role'] {
  return ROLE_MAP[dbRole] ?? 'Custodian';
}
