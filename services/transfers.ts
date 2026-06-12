import { api } from './api-client';

export type TransferRequest = {
  id: string;
  assetId: string;
  fromLocation: string;
  toLocation: string;
  toCustodian: string;
  toCustodianId?: string;
  requestedById: string;
  status: string;
  requestedAt: string;
  asset: { id: string; name: string; productId: string; custodian: { id: string; name: string } };
};

export const transferService = {
  getPending: () => api.get<TransferRequest[]>('/api/transfers'),

  initiate: (data: { assetId: string; toLocation: string; subLocation?: string; toCustodian: string; toCustodianId?: string }) =>
    api.post<{ initiated: boolean }>('/api/transfers', data),

  approve: (id: string, custodianId: string) =>
    api.post<{ approved: boolean }>(`/api/transfers/${id}/approve`, { custodianId }),

  reject: (id: string) =>
    api.post<{ rejected: boolean }>(`/api/transfers/${id}/reject`, {}),
};
