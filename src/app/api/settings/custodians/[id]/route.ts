import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import { UpdateCustodianSchema } from '@/backend/lib/validation';
import prisma from '@/backend/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const data = UpdateCustodianSchema.parse(await req.json());
    const custodian = await prisma.custodian.update({ where: { id }, data });
    return ok(custodian);
  } catch (error) { return handleError(error); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    await prisma.custodian.update({ where: { id }, data: { isActive: false } });
    return ok({ deleted: true });
  } catch (error) { return handleError(error); }
}
