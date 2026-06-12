import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import { BulkCreateSchema } from '@/lib/validation';
import { calculateDepreciationSchedule } from '@/utils/depreciation';
import prisma from '@/lib/prisma';

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

    // Compute next serial per prefix atomically inside the transaction
    const uniquePrefixes = [...new Set(rows.map(r => r.prefix.endsWith('/') ? r.prefix : r.prefix + '/'))];

    const existingSerials = await Promise.all(
      uniquePrefixes.map(async prefix => {
        const existing = await prisma.asset.findMany({
          where: { productId: { startsWith: prefix } },
          select: { productId: true },
        });
        let max = 0;
        for (const a of existing) {
          const num = parseInt(a.productId.slice(prefix.length).split('-')[0], 10);
          if (!isNaN(num) && num > max) max = num;
        }
        return [prefix, max] as [string, number];
      }),
    );

    const nextSerial = new Map(existingSerials.map(([p, max]) => [p, max + 1]));

    const createdIds: string[] = [];
    const createdProductIds: string[] = [];

    await prisma.$transaction(async tx => {
      for (const row of rows) {
        const prefix = row.prefix.endsWith('/') ? row.prefix : row.prefix + '/';
        const serial = (nextSerial.get(prefix) ?? 1).toString().padStart(4, '0');
        nextSerial.set(prefix, (nextSerial.get(prefix) ?? 1) + 1);
        const productId = prefix + serial;

        let acquisitionDate = new Date(row.date);
        if (isNaN(acquisitionDate.getTime())) acquisitionDate = new Date();
        let registrationDate = new Date(row.registrationDate);
        if (isNaN(registrationDate.getTime())) registrationDate = new Date();

        const method = METHOD_MAP[row.depreciationMethod] ?? 'STRAIGHT_LINE';
        const condition = COND_MAP[row.condition ?? ''] ?? 'A2';

        const custodianId = row.custodianId ?? user.id;
        const custodianExists = await tx.user.findUnique({ where: { id: custodianId }, select: { id: true } });
        const resolvedCustodianId = custodianExists ? custodianId : user.id;

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

    return ok({ createdIds, createdProductIds }, 201);
  } catch (error) {
    return handleError(error);
  }
}
