import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requireAuth, requirePermission } from '@/backend/lib/auth-helpers';
import { CreateLocationSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;
    const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return ok(locations);
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const body = await req.json();
    const { name, code } = CreateLocationSchema.parse(body);

    let resolvedCode = code;
    if (!resolvedCode) {
      resolvedCode = name.slice(0, 3).toUpperCase().replace(/\s/g, '') || 'LOC';
      const exists = await prisma.location.findFirst({ where: { code: resolvedCode } });
      if (exists) resolvedCode = resolvedCode + String(Date.now()).slice(-4);
    }

    const location = await prisma.location.create({ data: { name, code: resolvedCode } });
    return ok(location, 201);
  } catch (error) { return handleError(error); }
}
