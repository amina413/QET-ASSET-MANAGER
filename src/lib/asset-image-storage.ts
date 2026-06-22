import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type PresignedAssetImageUpload = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  maxBytes: number;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required object storage env var: ${name}`);
  return value;
}

let _s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (_s3Client) return _s3Client;
  const endpoint = process.env.ASSET_IMAGE_S3_ENDPOINT;
  _s3Client = new S3Client({
    region: getRequiredEnv('ASSET_IMAGE_S3_REGION'),
    ...(endpoint ? { endpoint, forcePathStyle: process.env.ASSET_IMAGE_S3_FORCE_PATH_STYLE === 'true' } : {}),
    credentials: {
      accessKeyId: getRequiredEnv('ASSET_IMAGE_S3_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('ASSET_IMAGE_S3_SECRET_ACCESS_KEY'),
    },
  });
  return _s3Client;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'asset-image';
}

export function validateAssetImageUpload(contentType: string, contentLength: number): void {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.');
  }
  if (!Number.isInteger(contentLength) || contentLength <= 0 || contentLength > MAX_IMAGE_BYTES) {
    throw new Error(`Image must be between 1 byte and ${MAX_IMAGE_BYTES} bytes.`);
  }
}

export async function createAssetImageUploadUrl(input: {
  assetId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
}): Promise<PresignedAssetImageUpload> {
  validateAssetImageUpload(input.contentType, input.contentLength);

  const bucket = getRequiredEnv('ASSET_IMAGE_S3_BUCKET');
  const publicBaseUrl = getRequiredEnv('ASSET_IMAGE_PUBLIC_BASE_URL').replace(/\/+$/, '');
  const key = `assets/${input.assetId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });

  return {
    uploadUrl: await getSignedUrl(getClient(), command, { expiresIn: 300 }),
    publicUrl: `${publicBaseUrl}/${key}`,
    key,
    maxBytes: MAX_IMAGE_BYTES,
  };
}

export function isManagedAssetImageUrl(url: string, assetId?: string): boolean {
  const publicBaseUrl = process.env.ASSET_IMAGE_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!publicBaseUrl || !url.startsWith(`${publicBaseUrl}/assets/`)) return false;
  if (!assetId) return true;

  try {
    const parsed = new URL(url);
    const base = new URL(publicBaseUrl);
    const relativePath = parsed.pathname.slice(base.pathname.replace(/\/+$/, '').length);
    const [, root, pathAssetId] = relativePath.split('/');
    return root === 'assets' && pathAssetId === assetId;
  } catch {
    return false;
  }
}
