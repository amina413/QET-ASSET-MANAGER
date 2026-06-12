import { api } from './api-client';
import type { Asset } from '@/shared/types';

export const assetService = {
  getAll: () => api.get<Asset[]>('/api/assets'),

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

  getNextSerial: (prefix: string) =>
    api.get<{ next: string }>(`/api/assets/serial?prefix=${encodeURIComponent(prefix)}`),

  clearAll: () => api.delete<{ cleared: boolean }>('/api/assets/clear'),
};
