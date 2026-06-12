import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requireAuth, requirePermission } from '@/lib/auth-helpers';
import { CreateDepartmentSchema, SyncDepartmentsSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;
    const departments = await prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return ok(departments);
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const body = await req.json();

    // Handle sync operation
    if (body.sync) {
      const { locationBranches, codes } = SyncDepartmentsSchema.parse(body);
      const existing = await prisma.department.findMany({ select: { name: true } });
      const existingNames = new Set(existing.map(d => d.name));
      const toCreate: { name: string; code: string; location: string }[] = [];
      const seen = new Set<string>();

      for (const [loc, branches] of Object.entries(locationBranches)) {
        for (const name of branches) {
          const trimmed = name.trim();
          if (!trimmed || seen.has(trimmed) || existingNames.has(trimmed)) continue;
          seen.add(trimmed);
          const rawCode = codes[trimmed] ?? trimmed.slice(0, 5).toUpperCase().replace(/\s/g, '');
          toCreate.push({ name: trimmed, code: rawCode, location: loc });
        }
      }

      if (toCreate.length > 0) {
        await prisma.department.createMany({ data: toCreate, skipDuplicates: true });
      }

      return ok({ added: toCreate.length });
    }

    const data = CreateDepartmentSchema.parse(body);
    const department = await prisma.department.create({ data });
    return ok(department, 201);
  } catch (error) { return handleError(error); }
}
