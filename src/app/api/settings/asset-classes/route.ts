import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requireAuth, requirePermission } from '@/lib/auth-helpers';
import { CreateAssetClassSchema, CreateCustodianOptionSchema } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;
    const assetClasses = await prisma.assetClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { custodianOptions: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    });
    return ok(assetClasses);
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const body = await req.json();

    if (body.assetClassId) {
      // Creating a custodian option
      const data = CreateCustodianOptionSchema.parse(body);
      const option = await prisma.custodianOption.create({ data: { assetClassId: data.assetClassId, name: data.name } });
      return ok(option, 201);
    }

    const data = CreateAssetClassSchema.parse(body);
    const assetClass = await prisma.assetClass.create({ data: { name: data.name, code: data.code ?? null } });
    return ok(assetClass, 201);
  } catch (error) { return handleError(error); }
}
