import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err, handleError } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

const UpdateAssetTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).nullable().optional(),
  categoryId: z.string().cuid().optional(),
}).refine(d => Object.values(d).some(v => v !== undefined), { message: 'At least one field must be provided' });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission('system_settings');
    if (error) return error;
    const { id } = await params;
    const parse = UpdateAssetTypeSchema.safeParse(await req.json());
    if (!parse.success) return err(parse.error.errors[0]?.message ?? 'Invalid input', 400);
    const body = parse.data;
    await prisma.assetType.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.code !== undefined && { code: body.code?.trim() || null }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      },
    });
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
