import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/backend/lib/api';
import { requireAuth, requirePermission } from '@/backend/lib/auth-helpers';
import { CreateAssetSchema } from '@/backend/lib/validation';
import { calculateDepreciationSchedule } from '@/shared/utils/depreciation';
import prisma from '@/backend/lib/prisma';

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const assets = await prisma.asset.findMany({
      include: {
        custodian: { select: { id: true, name: true, email: true, department: true } },
        history: { include: { user: { select: { id: true, name: true } } }, orderBy: { date: 'desc' } },
        improvements: true,
        schedules: { orderBy: { fiscalYear: 'asc' } },
      },
      orderBy: { registrationDate: 'desc' },
    });

    const currentYear = new Date().getFullYear();

    const mapped = assets.map(a => {
      const currentSchedule = a.schedules.find(s => s.fiscalYear === currentYear)
        ?? a.schedules[a.schedules.length - 1];

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
        status: a.status.toLowerCase().replace('_', ' ') as 'active' | 'disposed' | 'maintenance' | 'pending transfer',
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
        history: a.history.map(h => ({
          id: h.id,
          assetId: h.assetId,
          date: h.date.toISOString().slice(0, 16).replace('T', ' '),
          action: h.action,
          user: h.user?.name ?? 'System',
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
    const custodian = await prisma.user.findUnique({ where: { id: data.custodianId }, select: { id: true } });
    if (!custodian) return err('Custodian not found', 404);

    const acquisitionDate = new Date(data.acquisitionDate);
    const registrationDate = data.registrationDate ? new Date(data.registrationDate) : new Date();

    const asset = await prisma.asset.create({
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
        method: data.depreciationMethod as Parameters<typeof prisma.asset.create>[0]['data']['method'],
        location: data.location,
        subLocation: data.subLocation,
        custodianId: data.custodianId,
        conditionCode: data.condition ?? 'A1',
        status: 'ACTIVE',
      },
    });

    const scheduleData = calculateDepreciationSchedule({
      acquisition_cost: data.acquisitionCost,
      registration_date: registrationDate.toISOString(),
      useful_life: data.usefulLife,
      salvage_value: data.salvageValue,
      method: data.depreciationMethod as Parameters<typeof calculateDepreciationSchedule>[0]['method'],
    });

    await prisma.$transaction([
      prisma.depreciationSchedule.createMany({
        data: scheduleData.map(s => ({
          assetId: asset.id,
          year: s.year,
          fiscalYear: s.fiscal_year,
          depreciationExpense: s.depreciation_expense,
          accumulatedDepr: s.accumulated_depreciation,
          netBookValue: s.net_book_value,
        })),
      }),
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          userId: user.id,
          action: 'Asset Registered',
          details: `Initial registration of ${asset.name}`,
          type: 'Registration',
        },
      }),
    ]);

    return ok({ assetId: asset.id, productId: asset.productId }, 201);
  } catch (error) {
    return handleError(error);
  }
}
