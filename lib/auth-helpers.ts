import { getSession, SessionUser } from '@/lib/session';
import { hasPermission, Permission } from '@/lib/permissions';
import { unauthorized, forbidden } from '@/lib/api';
import { NextResponse } from 'next/server';

type AuthResult =
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const session = await getSession();
  if (!session.user) {
    return { user: null, error: unauthorized() };
  }
  return { user: session.user, error: null };
}

export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const session = await getSession();
  if (!session.user) {
    return { user: null, error: unauthorized() };
  }
  if (!hasPermission(session.user.role, permission)) {
    return { user: null, error: forbidden() };
  }
  return { user: session.user, error: null };
}
