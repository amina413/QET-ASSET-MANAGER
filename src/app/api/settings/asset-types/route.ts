import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requireAuth, requirePermission } from '@/lib/auth-helpers';
import { CreateAssetTypeSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth();
    if (error) return error;
    const categoryId = req.nextUrl.searchParams.get('categoryId') ?? undefined;
    const assetTypes = await prisma.assetType.findMany({
      where: { isActive: true, ...(categoryId && { categoryId }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true },
    });
    return ok(assetTypes);
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const data = CreateAssetTypeSchema.parse(await req.json());
    const assetType = await prisma.assetType.create({ data: { categoryId: data.categoryId, name: data.name, code: data.code ?? null } });
    return ok(assetType, 201);
  } catch (error) { return handleError(error); }
}
