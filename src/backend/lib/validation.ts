import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  department: z.string().min(1).max(100).trim(),
  role: z.enum(['SYSTEM_ADMIN', 'ASSET_MANAGER', 'CUSTODIAN', 'AUDITOR']).default('CUSTODIAN'),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  department: z.string().min(1).max(100).trim().optional(),
  role: z.enum(['SYSTEM_ADMIN', 'ASSET_MANAGER', 'CUSTODIAN', 'AUDITOR']).optional(),
  password: z.string().min(8).max(128).optional(),
});

export const CreateAssetSchema = z.object({
  productId: z.string().min(1).max(100).trim(),
  name: z.string().min(1).max(200).trim(),
  category: z.string().min(1).max(100).trim(),
  subCategory: z.string().max(100).trim().optional(),
  acquisitionCost: z.number().positive('Acquisition cost must be positive'),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  salvageValue: z.number().min(0).default(0),
  usefulLife: z.number().int().min(1).max(100),
  depreciationMethod: z.enum(['STRAIGHT_LINE', 'REDUCING_BALANCE', 'SUM_OF_YEARS']).default('STRAIGHT_LINE'),
  location: z.string().min(1).max(200).trim(),
  subLocation: z.string().max(200).trim().optional(),
  custodianId: z.string().min(1),
  condition: z.string().max(10).optional().default('A1'),
});

export const BulkAssetRowSchema = z.object({
  prefix: z.string().min(1).max(100),
  name: z.string().min(1).max(200).trim(),
  category: z.string().min(1).max(100).trim(),
  subCategory: z.string().max(100).trim().optional(),
  cost: z.number().positive(),
  date: z.string(),
  registrationDate: z.string(),
  salvageValue: z.number().min(0).default(0),
  life: z.number().int().min(1).max(100),
  depreciationMethod: z.string().default('Straight Line'),
  location: z.string().min(1).max(200).trim(),
  subLocation: z.string().max(200).trim().optional(),
  condition: z.string().max(20).optional().default('Good'),
  custodianId: z.string().optional(),
});

export const BulkCreateSchema = z.object({
  rows: z.array(BulkAssetRowSchema).min(1).max(500),
});

export const UpdateAssetConditionSchema = z.object({
  conditionCode: z.enum(['A1', 'A2', 'A3', 'A4', 'F1', 'F2', 'F3', 'F4']),
});

export const AddImprovementSchema = z.object({
  type: z.enum(['Addition', 'Reduction', 'Revaluation']),
  amount: z.number().positive(),
  description: z.string().min(1).max(500).trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const AddHistorySchema = z.object({
  action: z.string().min(1).max(200).trim(),
  details: z.string().min(1).max(1000).trim(),
  type: z.enum(['Registration', 'Transfer', 'Maintenance', 'Audit', 'Issue', 'Update']),
  updateStatus: z.enum(['Active', 'Maintenance', 'Disposed']).optional(),
});

export const UpdateAssetImageSchema = z.object({
  imageUrl: z.string().min(1).max(5_000_000),
});

export const InitiateTransferSchema = z.object({
  assetId: z.string().min(1),
  toLocation: z.string().min(1).max(200).trim(),
  subLocation: z.string().max(200).trim().optional(),
  toCustodian: z.string().min(1).max(200).trim(),
  toCustodianId: z.string().optional(),
});

export const ApproveTransferSchema = z.object({
  custodianId: z.string().min(1),
});

export const CreateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  code: z.string().min(1).max(20).trim().toUpperCase(),
  location: z.string().min(1).max(200).trim(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

export const CreateCustodianSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  department: z.string().min(1).max(100).trim(),
  location: z.string().min(1).max(200).trim(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
});

export const UpdateCustodianSchema = CreateCustodianSchema.partial();

export const CreateLocationSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  code: z.string().max(20).trim().toUpperCase().optional(),
});

export const UpdateLocationSchema = CreateLocationSchema.partial();

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  code: z.string().max(20).trim().optional(),
});

export const CreateAssetTypeSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(100).trim(),
  code: z.string().max(20).trim().optional(),
});

export const CreateAssetClassSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  code: z.string().max(20).trim().optional(),
});

export const CreateCustodianOptionSchema = z.object({
  assetClassId: z.string().min(1),
  name: z.string().min(1).max(100).trim(),
});

const AssetSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  acquisitionCost: z.union([z.number(), z.string()]).optional(),
});

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export const AiQuerySchema = z.object({
  message: z.string().min(1).max(2000).trim(),
  assetsSnapshot: z.array(AssetSnapshotSchema).max(100).optional().default([]),
  images: z.array(
    z.string().refine(
      img => ALLOWED_IMAGE_MIME_TYPES.some(mime => img.startsWith(`data:${mime};base64,`)),
      { message: 'Only JPEG, PNG, GIF, and WebP images are allowed' },
    ),
  ).max(5).optional(),
  documents: z.array(z.object({
    name: z.string().max(200),
    content: z.string().max(50000),
    type: z.string().max(100),
  })).max(5).optional(),
});

export const SyncDepartmentsSchema = z.object({
  locationBranches: z.record(z.array(z.string())),
  codes: z.record(z.string()),
});
