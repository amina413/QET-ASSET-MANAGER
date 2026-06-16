import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'System Admin' | 'Asset Manager' | 'Custodian' | 'Auditor';
  lastLogin: string | null;
};

export type AppSession = {
  user?: SessionUser;
  csrfToken?: string;
};

let cachedOptions: SessionOptions | null = null;

// Validated lazily (not at module load) so `next build` doesn't fail when
// SESSION_SECRET isn't present in the build environment.
export function getSessionOptions(): SessionOptions {
  if (cachedOptions) return cachedOptions;

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET env var must be set to at least 32 characters. Add it to your .env file.');
  }

  cachedOptions = {
    password: secret,
    cookieName: 'qet_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
    },
  };
  return cachedOptions;
}

export async function getSession(): Promise<IronSession<AppSession>> {
  const cookieStore = await cookies();
  return getIronSession<AppSession>(cookieStore, getSessionOptions());
}

export async function getSessionFromRequest(
  req: NextRequest,
  res: NextResponse,
): Promise<IronSession<AppSession>> {
  return getIronSession<AppSession>(req, res, getSessionOptions());
}

const ROLE_MAP: Record<string, SessionUser['role']> = {
  SYSTEM_ADMIN: 'System Admin',
  ASSET_MANAGER: 'Asset Manager',
  CUSTODIAN: 'Custodian',
  AUDITOR: 'Auditor',
};

export function dbRoleToDisplay(dbRole: string): SessionUser['role'] {
  const role = ROLE_MAP[dbRole];
  if (!role) {
    throw new Error(`Unknown role "${dbRole}" — refusing to grant a fallback role.`);
  }
  return role;
}
