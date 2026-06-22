import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/api';
import { requireAuth, requirePermission } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/permissions';
import { CreateAssetSchema } from '@/lib/validation';
import { calculateDepreciationSchedule } from '@/utils/depreciation';
import { STATUS_MAP } from '@/lib/asset-constants';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '500', 10) || 500, 1), 500);
    const skip = Math.max(parseInt(searchParams.get('skip') ?? '0', 10) || 0, 0);
    const where: Prisma.AssetWhereInput = { isActive: true };
    const canViewAuditLogs = hasPermission(user.role, 'view_audit_logs');

    if (!hasPermission(user.role, 'view_all_reports')) {
      where.custodianId = user.id;
    }

    const assets = await prisma.asset.findMany({
      where,
      take: limit,
      skip,
      include: {
        custodian: { select: { id: true, name: true, email: true, department: true } },
        ...(canViewAuditLogs ? { history: { include: { user: { select: { id: true, name: true } } }, orderBy: { date: 'desc' as const } } } : {}),
        improvements: true,
        schedules: { orderBy: { fiscalYear: 'asc' } },
      },
      orderBy: { registrationDate: 'desc' },
    });

    const currentYear = new Date().getFullYear();

    const mapped = assets.map(a => {
      const currentSchedule = a.schedules.find(s => s.fiscalYear === currentYear)
        ?? a.schedules[a.schedules.length - 1];
      const history = canViewAuditLogs && Array.isArray((a as { history?: unknown }).history)
        ? a.history as Array<{
          id: string;
          assetId: string;
          date: Date;
          action: string;
          user?: { name: string } | null;
          userId: string;
          details: string;
          type: string;
          fromLocation: string | null;
          toLocation: string | null;
          toCustodian: string | null;
        }>
        : [];

      return {
        id: a.id,
        productId: a.productId,
        name: a.name,
        category: a.category,
        subCategory: a.subCategory ?? undefined,
        acquisitionCost: Number(a.acquisitionCost),
        acquisitionDate: a.acquisitionDate.toISOString().split('T')[0],
        netBookValue: currentSchedule ? Number(currentSchedule.netBookValue) : Number(a.acquisitionCost),
        location: a.location,
        subLocation: a.subLocation ?? undefined,
        custodian: a.custodian.name,
        custodianId: a.custodian.id,
        status: STATUS_MAP[a.status] ?? 'Active',
        conditionCode: a.conditionCode ?? undefined,
        imageUrl: a.imageUrl ?? undefined,
        registrationDate: a.registrationDate.toISOString().split('T')[0],
        usefulLife: a.usefulLife,
        salvageValue: Number(a.salvageValue),
        method: a.method,
        improvements: a.improvements.map(imp => ({
          id: imp.id,
          date: imp.date.toISOString().split('T')[0],
          type: imp.type as 'Addition' | 'Reduction' | 'Revaluation',
          amount: Number(imp.amount),
          description: imp.description,
          newAcquisitionCost: Number(imp.newAcquisitionCost),
        })),
        history: history.map(h => ({
          id: h.id,
          assetId: h.assetId,
          date: h.date.toISOString().slice(0, 16).replace('T', ' '),
          action: h.action,
          user: h.user?.name ?? 'System',
          userId: h.userId,
          details: h.details,
          type: h.type,
          fromLocation: h.fromLocation ?? undefined,
          toLocation: h.toLocation ?? undefined,
          toCustodian: h.toCustodian ?? undefined,
        })),
      };
    });

    return ok(mapped);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission('register_asset');
    if (error) return error;

    const body = await req.json();
    const data = CreateAssetSchema.parse(body);

    // Validate custodian exists
    const custodian = await prisma.user.findUnique({ where: { id: data.custodianId }, select: { id: true, isActive: true } });
    if (!custodian || !custodian.isActive) return err('Custodian not found', 404);

    const acquisitionDate = new Date(data.acquisitionDate);
    const registrationDate = data.registrationDate ? new Date(data.registrationDate) : new Date();

    const scheduleData = calculateDepreciationSchedule({
      acquisition_cost: data.acquisitionCost,
      registration_date: registrationDate.toISOString(),
      useful_life: data.usefulLife,
      salvage_value: data.salvageValue,
      method: data.depreciationMethod as Parameters<typeof calculateDepreciationSchedule>[0]['method'],
    });

    const asset = await prisma.$transaction(async tx => {
      const createdAsset = await tx.asset.create({
        data: {
          productId: data.productId,
          name: data.name,
          category: data.category,
          subCategory: data.subCategory,
          acquisitionCost: data.acquisitionCost,
          acquisitionDate,
          registrationDate,
          salvageValue: data.salvageValue,
          usefulLife: data.usefulLife,
          method: data.depreciationMethod as Parameters<typeof tx.asset.create>[0]['data']['method'],
          location: data.location,
          subLocation: data.subLocation,
          custodianId: data.custodianId,
          conditionCode: data.condition ?? 'A1',
          status: 'ACTIVE',
        },
      });

      await tx.depreciationSchedule.createMany({
        data: scheduleData.map(s => ({
          assetId: createdAsset.id,
          year: s.year,
          fiscalYear: s.fiscal_year,
          depreciationExpense: s.depreciation_expense,
          accumulatedDepr: s.accumulated_depreciation,
          netBookValue: s.net_book_value,
        })),
      });
      await tx.assetHistory.create({
        data: {
          assetId: createdAsset.id,
          userId: user.id,
          action: 'Asset Registered',
          details: `Initial registration of ${createdAsset.name}`,
          type: 'Registration',
        },
      });

      return createdAsset;
    });

    return ok({ assetId: asset.id, productId: asset.productId }, 201);
  } catch (error) {
    return handleError(error);
  }
}
