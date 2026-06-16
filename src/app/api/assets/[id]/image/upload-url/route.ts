import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err, handleError } from '@/backend/lib/api';
import { requireAssetAccess, requirePermission } from '@/backend/lib/auth-helpers';
import { createAssetImageUploadUrl } from '@/backend/lib/asset-image-storage';

const CreateUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  contentLength: z.number().int().positive().max(5 * 1024 * 1024),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission('edit_asset');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data = CreateUploadUrlSchema.parse(body);

    const { asset, error: assetError } = await requireAssetAccess(user, id);
    if (assetError) return assetError;

    try {
      const upload = await createAssetImageUploadUrl({
        assetId: asset.id,
        fileName: data.fileName,
        contentType: data.contentType,
        contentLength: data.contentLength,
      });
      return ok(upload);
    } catch (storageError) {
      return err(storageError instanceof Error ? storageError.message : 'Image storage is not configured', 503);
    }
  } catch (error) {
    return handleError(error);
  }
}
