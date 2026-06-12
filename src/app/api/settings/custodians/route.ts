import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requireAuth, requirePermission } from '@/backend/lib/auth-helpers';
import { CreateCustodianSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;
    const custodians = await prisma.custodian.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return ok(custodians);
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const data = CreateCustodianSchema.parse(await req.json());
    const custodian = await prisma.custodian.create({ data });
    return ok(custodian, 201);
  } catch (error) { return handleError(error); }
}
