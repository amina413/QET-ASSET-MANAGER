import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err, handleError } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

const UpdateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().toUpperCase().max(20).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateCategorySchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);
    await prisma.category.update({ where: { id }, data: { ...(parsed.data.name && { name: parsed.data.name }), ...(parsed.data.code !== undefined && { code: parsed.data.code || null }) } });
    return ok({ updated: true });
  } catch (error) { return handleError(error); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    await prisma.category.update({ where: { id }, data: { isActive: false } });
    return ok({ deleted: true });
  } catch (error) { return handleError(error); }
}
