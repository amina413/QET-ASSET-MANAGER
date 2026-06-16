import { NextRequest } from 'next/server';
import { ok, handleError } from '@/backend/lib/api';
import { requirePermission } from '@/backend/lib/auth-helpers';
import { BulkCreateSchema } from '@/backend/lib/validation';
import { calculateDepreciationSchedule } from '@/shared/utils/depreciation';
import prisma from '@/backend/lib/prisma';

const METHOD_MAP: Record<string, string> = {
  'Reducing Balance': 'REDUCING_BALANCE',
  'Sum of Years': 'SUM_OF_YEARS',
  'Straight Line': 'STRAIGHT_LINE',
};

const COND_MAP: Record<string, string> = {
  'New': 'A1', 'Good': 'A2', 'Fair': 'A3', 'Poor': 'A4',
};

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission('register_asset');
    if (error) return error;

    const body = await req.json();
    const { rows } = BulkCreateSchema.parse(body);

    const uniquePrefixes = [...new Set(rows.map(r => r.prefix.endsWith('/') ? r.prefix : r.prefix + '/'))];

    const createdIds: string[] = [];
    const createdProductIds: string[] = [];
    const warnings: string[] = [];

    await prisma.$transaction(async tx => {
      // Serial computation happens INSIDE the transaction to prevent race conditions
      const serialMap = new Map<string, number>();
      for (const prefix of uniquePrefixes) {
        const existing = await tx.asset.findMany({
          where: { productId: { startsWith: prefix } },
          select: { productId: true },
        });
        let max = 0;
        for (const a of existing) {
          const num = parseInt(a.productId.slice(prefix.length).split('-')[0], 10);
          if (!isNaN(num) && num > max) max = num;
        }
        serialMap.set(prefix, max + 1);
      }

      for (const row of rows) {
        const prefix = row.prefix.endsWith('/') ? row.prefix : row.prefix + '/';
        const serial = (serialMap.get(prefix) ?? 1).toString().padStart(4, '0');
        serialMap.set(prefix, (serialMap.get(prefix) ?? 1) + 1);
        const productId = prefix + serial;

        const acquisitionDate = new Date(row.date);
        const registrationDate = new Date(row.registrationDate);

        const method = METHOD_MAP[row.depreciationMethod] ?? 'STRAIGHT_LINE';
        const condition = COND_MAP[row.condition ?? ''] ?? 'A2';

        const custodianId = row.custodianId ?? user.id;
        const custodianExists = await tx.user.findUnique({ where: { id: custodianId }, select: { id: true, isActive: true } });
        const resolvedCustodianId = custodianExists?.isActive ? custodianId : user.id;
        if ((!custodianExists || !custodianExists.isActive) && row.custodianId) {
          warnings.push(`Row "${row.name}": custodian ID "${row.custodianId}" not found or inactive — assigned to uploader.`);
        }

        const asset = await tx.asset.create({
          data: {
            productId, name: row.name, category: row.category, subCategory: row.subCategory,
            acquisitionCost: row.cost, acquisitionDate, registrationDate,
            salvageValue: row.salvageValue, usefulLife: row.life,
            method: method as Parameters<typeof tx.asset.create>[0]['data']['method'],
            location: row.location, subLocation: row.subLocation,
            custodianId: resolvedCustodianId, conditionCode: condition, status: 'ACTIVE',
          },
        });

        const scheduleData = calculateDepreciationSchedule({
          acquisition_cost: row.cost,
          registration_date: registrationDate.toISOString(),
          useful_life: row.life,
          salvage_value: row.salvageValue,
          method: method as Parameters<typeof calculateDepreciationSchedule>[0]['method'],
        });

        await tx.depreciationSchedule.createMany({
          data: scheduleData.map(s => ({
            assetId: asset.id, year: s.year, fiscalYear: s.fiscal_year,
            depreciationExpense: s.depreciation_expense,
            accumulatedDepr: s.accumulated_depreciation, netBookValue: s.net_book_value,
          })),
        });

        await tx.assetHistory.create({
          data: {
            assetId: asset.id, userId: user.id,
            action: 'Asset Registered', details: `Bulk import: ${row.name}`, type: 'Registration',
          },
        });

        createdIds.push(asset.id);
        createdProductIds.push(productId);
      }
    });

    return ok({ createdIds, createdProductIds, warnings }, 201);
  } catch (error) {
    return handleError(error);
  }
}
