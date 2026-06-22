import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/api';
import { requireAssetAccess, requirePermission } from '@/lib/auth-helpers';
import { AddImprovementSchema } from '@/lib/validation';
import { calculateDepreciationSchedule } from '@/utils/depreciation';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('adjust_asset_value');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data = AddImprovementSchema.parse(body);

    const { asset, error: assetError } = await requireAssetAccess<{
      id: string;
      custodianId: string;
      isActive: boolean;
      acquisitionCost: unknown;
      registrationDate: Date;
      usefulLife: number;
      salvageValue: unknown;
      method: string;
    }>(user, id, {
      id: true,
      custodianId: true,
      isActive: true,
      acquisitionCost: true,
      registrationDate: true,
      usefulLife: true,
      salvageValue: true,
      method: true,
    });
    if (assetError) return assetError;

    const currentCost = Number(asset.acquisitionCost);

    if (data.type === 'Reduction' && data.amount > currentCost) {
      return err(`Reduction amount (${data.amount}) exceeds current asset cost (${currentCost})`, 422);
    }
    if (data.type === 'Revaluation' && data.amount <= 0) {
      return err('Revaluation amount must be a positive value (the new total cost)', 422);
    }

    // Addition/Reduction are deltas applied to the current cost; Revaluation
    // sets the cost to an absolute new value.
    // Round to 2dp to avoid float arithmetic drift (e.g. 100.10 + 0.20 = 100.30000000000001).
    // TODO: switch to a Decimal library for full production-grade financial precision.
    const newCost = data.type === 'Addition'
      ? Math.round((currentCost + data.amount) * 100) / 100
      : data.type === 'Reduction'
        ? Math.round((currentCost - data.amount) * 100) / 100
        : Math.round(data.amount * 100) / 100;

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
