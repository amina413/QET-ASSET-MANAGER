import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/api';
import { requireAssetAccess, requirePermission } from '@/lib/auth-helpers';
import { UpdateAssetImageSchema } from '@/lib/validation';
import { isManagedAssetImageUrl } from '@/lib/asset-image-storage';
import prisma from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('edit_asset');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { imageUrl } = UpdateAssetImageSchema.parse(body);

    if (!isManagedAssetImageUrl(imageUrl, id)) {
      return err('Asset image URL must come from configured object storage for this asset.', 422);
    }

    const { asset, error: assetError } = await requireAssetAccess<{ id: string; name: string; custodianId: string; isActive: boolean }>(
      user,
      id,
      { id: true, name: true, custodianId: true, isActive: true },
    );
    if (assetError) return assetError;

    await prisma.$transaction([
      prisma.asset.update({ where: { id: asset.id }, data: { imageUrl } }),
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          userId: user.id,
          action: 'Image Updated',
          details: `Image updated for ${asset.name}`,
          type: 'Update',
        },
      }),
    ]);

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
