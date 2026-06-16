import { NextRequest } from 'next/server';
import { ok, err, handleError, notFound } from '@/backend/lib/api';
import { requireAuth, requirePermission } from '@/backend/lib/auth-helpers';
import { hasPermission } from '@/backend/lib/permissions';
import prisma from '@/backend/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const canViewAuditLogs = hasPermission(user.role, 'view_audit_logs');
    const asset = await prisma.asset.findFirst({
      where: {
        id,
        isActive: true,
        ...(hasPermission(user.role, 'view_all_reports') ? {} : { custodianId: user.id }),
      },
      include: {
        custodian: { select: { id: true, name: true } },
        ...(canViewAuditLogs ? { history: { include: { user: { select: { name: true } } }, orderBy: { date: 'desc' as const } } } : {}),
        improvements: true,
        schedules: { orderBy: { fiscalYear: 'asc' } },
      },
    });

    if (!asset) return notFound('Asset');
    return ok({ ...asset, history: canViewAuditLogs && 'history' in asset ? asset.history : [] });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('delete_asset');
    if (error) return error;

    const { id } = await params;
    const existing = await prisma.asset.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!existing) return notFound('Asset');
    if (!existing.isActive) return err('Asset has already been removed', 409);

    // Soft delete: preserve the row so AssetHistory/improvements/schedules/transfer FKs stay intact.
    await prisma.$transaction([
      prisma.asset.update({ where: { id }, data: { isActive: false, status: 'DISPOSED' } }),
      prisma.assetHistory.create({
        data: {
          assetId: id,
          userId: user.id,
          action: 'Asset Removed',
          details: 'Asset removed from the active register.',
          type: 'Update',
        },
      }),
    ]);
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
