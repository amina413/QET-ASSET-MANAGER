import { NextRequest } from 'next/server';
import { ok, handleError, notFound } from '@/backend/lib/api';
import { requireAuth } from '@/backend/lib/auth-helpers';
import { AddImprovementSchema } from '@/backend/lib/validation';
import { calculateDepreciationSchedule } from '@/shared/utils/depreciation';
import prisma from '@/backend/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data = AddImprovementSchema.parse(body);

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) return notFound('Asset');

    const currentCost = Number(asset.acquisitionCost);
    const newCost = data.type === 'Addition'
      ? currentCost + data.amount
      : Math.max(0, currentCost - data.amount);

    const scheduleData = calculateDepreciationSchedule({
      acquisition_cost: newCost,
      registration_date: asset.registrationDate.toISOString(),
      useful_life: asset.usefulLife,
      salvage_value: Number(asset.salvageValue),
      method: asset.method as Parameters<typeof calculateDepreciationSchedule>[0]['method'],
    });

    // Single transaction: improvement + cost update + schedule rebuild + history
    await prisma.$transaction(async tx => {
      await tx.assetImprovement.create({
        data: {
          assetId: id,
          type: data.type as Parameters<typeof tx.assetImprovement.create>[0]['data']['type'],
          amount: data.amount,
          description: data.description,
          newAcquisitionCost: newCost,
          date: new Date(data.date),
        },
      });

      await tx.asset.update({ where: { id }, data: { acquisitionCost: newCost } });

      await tx.depreciationSchedule.deleteMany({ where: { assetId: id } });

      await tx.depreciationSchedule.createMany({
        data: scheduleData.map(s => ({
          assetId: id,
          year: s.year,
          fiscalYear: s.fiscal_year,
          depreciationExpense: s.depreciation_expense,
          accumulatedDepr: s.accumulated_depreciation,
          netBookValue: s.net_book_value,
        })),
      });

      await tx.assetHistory.create({
        data: {
          assetId: id,
          userId: user.id,
          action: `Value ${data.type}: ₦${data.amount.toLocaleString()}`,
          details: data.description,
          type: 'Update',
        },
      });
    });

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
