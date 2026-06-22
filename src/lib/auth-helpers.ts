import { getSession, SessionUser } from '@/lib/session';
import { dbRoleToDisplay } from '@/lib/session';
import { hasPermission, Permission } from '@/lib/permissions';
import { unauthorized, forbidden, notFound } from '@/lib/api';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type AuthResult =
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse };

type AssetAccessResult<T> =
  | { asset: T; error: null }
  | { asset: null; error: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const session = await getSession();
  if (!session.user) {
    return { user: null, error: unauthorized() };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, department: true, role: true, lastLogin: true, isActive: true, sessionVersion: true },
  });

  if (!dbUser || !dbUser.isActive || session.user.sessionVersion !== dbUser.sessionVersion) {
    session.destroy();
    return { user: null, error: unauthorized() };
  }

  const freshUser: SessionUser = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    department: dbUser.department,
    role: dbRoleToDisplay(dbUser.role),
    lastLogin: dbUser.lastLogin ? dbUser.lastLogin.toISOString() : null,
    sessionVersion: dbUser.sessionVersion,
  };

  return { user: freshUser, error: null };
}

export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const auth = await requireAuth();
  if (auth.error) return auth;

  if (!hasPermission(auth.user.role, permission)) {
    return { user: null, error: forbidden() };
  }
  return auth;
}

/**
 * Scopes asset access by custodian assignment.
 * IMPORTANT: Callers with write intent MUST call requirePermission(...) BEFORE this helper.
 * This helper only filters visibility; it does not enforce write permissions.
 */
export async function requireAssetAccess<T extends { id: string; custodianId: string; isActive: boolean }>(
  user: SessionUser,
  assetId: string,
  select?: Prisma.AssetSelect,
): Promise<AssetAccessResult<T>> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, isActive: true },
    select: select ?? { id: true, custodianId: true, isActive: true },
  }) as T | null;

  if (!asset) return { asset: null, error: notFound('Asset') };

  if (!hasPermission(user.role, 'view_all_reports') && asset.custodianId !== user.id) {
    return { asset: null, error: forbidden() };
  }

  return { asset, error: null };
}
