import { api } from './api-client';
import type { Asset } from '@/types';

const ASSET_PAGE_SIZE = 500;

export const assetService = {
  getAll: async () => {
    const allAssets: Asset[] = [];
    let skip = 0;

    while (true) {
      const result = await api.get<Asset[]>(`/api/assets?limit=${ASSET_PAGE_SIZE}&skip=${skip}`);
      if (!result.success) return result;

      allAssets.push(...result.data);
      if (result.data.length < ASSET_PAGE_SIZE) {
        return { success: true as const, data: allAssets };
      }

      skip += ASSET_PAGE_SIZE;
    }
  },

  create: (data: unknown) => api.post<{ assetId: string; productId: string }>('/api/assets', data),

  bulkCreate: (rows: unknown[]) => api.post<{ createdIds: string[]; createdProductIds: string[] }>('/api/assets/bulk', { rows }),

  delete: (id: string) => api.delete<{ deleted: boolean }>(`/api/assets/${id}`),

  updateCondition: (id: string, conditionCode: string) =>
    api.put<{ updated: boolean }>(`/api/assets/${id}/condition`, { conditionCode }),

  addImprovement: (id: string, data: unknown) =>
    api.post<{ updated: boolean }>(`/api/assets/${id}/improvement`, data),

  addHistory: (id: string, data: unknown) =>
    api.post<{ created: boolean }>(`/api/assets/${id}/history`, data),

  updateImage: (id: string, imageUrl: string) =>
    api.put<{ updated: boolean }>(`/api/assets/${id}/image`, { imageUrl }),

  createImageUploadUrl: (id: string, file: File) =>
    api.post<{ uploadUrl: string; publicUrl: string; key: string; maxBytes: number }>(
      `/api/assets/${id}/image/upload-url`,
      { fileName: file.name, contentType: file.type, contentLength: file.size },
    ),

  getNextSerial: (prefix: string) =>
    api.get<{ next: string }>(`/api/assets/serial?prefix=${encodeURIComponent(prefix)}`),

  clearAll: (confirmation: string) => api.delete<{ cleared: boolean }>('/api/assets/clear', { confirmation }),
};
