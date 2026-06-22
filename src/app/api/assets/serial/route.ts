import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { error } = await requirePermission('register_asset');
    if (error) return error;

    const prefix = req.nextUrl.searchParams.get('prefix') ?? '';
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;

    const assets = await prisma.asset.findMany({
      where: { isActive: true, productId: { startsWith: normalized } },
      select: { productId: true },
    });

    let max = 0;
    for (const a of assets) {
      const num = parseInt(a.productId.slice(normalized.length).split('-')[0], 10);
      if (!isNaN(num) && num > max) max = num;
    }

    return ok({ next: (max + 1).toString().padStart(4, '0') });
  } catch (error) {
    return handleError(error);
  }
}
