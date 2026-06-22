import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/api';
import { requireAuth, requirePermission } from '@/lib/auth-helpers';
import { CreateLocationSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

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
      const base = name.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'LOC';
      let candidate = base;
      let attempt = 0;
      // Loop guards against a collision between the existence check and the
      // create() call below; the create() itself is still the source of truth
      // since `code` is a unique column.
      while (await prisma.location.findFirst({ where: { code: candidate } })) {
        attempt += 1;
        candidate = `${base}${String(attempt).padStart(2, '0')}`;
        if (attempt > 99) {
          return err('Could not generate a unique location code, please provide one manually', 409);
        }
      }
      resolvedCode = candidate;
    }

    const location = await prisma.location.create({ data: { name, code: resolvedCode } });
    return ok(location, 201);
  } catch (error) { return handleError(error); }
}
