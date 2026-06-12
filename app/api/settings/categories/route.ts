import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requireAuth, requirePermission } from '@/lib/auth-helpers';
import { CreateCategorySchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { assetTypes: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    });
    return ok(categories);
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const data = CreateCategorySchema.parse(await req.json());
    const category = await prisma.category.create({ data: { name: data.name, code: data.code ?? null } });
    return ok(category, 201);
  } catch (error) { return handleError(error); }
}
