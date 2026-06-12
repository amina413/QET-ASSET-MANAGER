import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import prisma from '@/backend/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const body = await req.json();
    await prisma.assetType.update({ where: { id }, data: { ...(body.name && { name: body.name.trim() }), ...(body.code !== undefined && { code: body.code?.trim() || null }) } });
    return ok({ updated: true });
  } catch (error) { return handleError(error); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    await prisma.assetType.update({ where: { id }, data: { isActive: false } });
    return ok({ deleted: true });
  } catch (error) { return handleError(error); }
}
