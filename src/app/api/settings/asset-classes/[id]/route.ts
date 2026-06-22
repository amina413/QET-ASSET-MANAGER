import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const body = await req.json();

    const isCustodianOption = body.isCustodianOption === true;
    if (isCustodianOption) {
      await prisma.custodianOption.update({ where: { id }, data: { ...(body.name && { name: String(body.name).trim().slice(0, 100) }) } });
      return ok({ updated: true });
    }

    await prisma.assetClass.update({ where: { id }, data: { ...(body.name && { name: String(body.name).trim().slice(0, 100) }), ...(body.code !== undefined && { code: body.code ? String(body.code).trim().toUpperCase().slice(0, 20) : null }) } });
    return ok({ updated: true });
  } catch (error) { return handleError(error); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const isCustodianOption = body.isCustodianOption === true;
    if (isCustodianOption) {
      await prisma.custodianOption.update({ where: { id }, data: { isActive: false } });
      return ok({ deleted: true });
    }

    await prisma.assetClass.update({ where: { id }, data: { isActive: false } });
    return ok({ deleted: true });
  } catch (error) { return handleError(error); }
}
