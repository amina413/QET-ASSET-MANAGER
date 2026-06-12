import { api } from './api-client';

export const settingsService = {
  // Departments
  getDepartments: () => api.get<unknown[]>('/api/settings/departments'),
  createDepartment: (data: unknown) => api.post<unknown>('/api/settings/departments', data),
  updateDepartment: (id: string, data: unknown) => api.put<unknown>(`/api/settings/departments/${id}`, data),
  deleteDepartment: (id: string) => api.delete<unknown>(`/api/settings/departments/${id}`),
  syncDepartments: (locationBranches: Record<string, string[]>, codes: Record<string, string>) =>
    api.post<{ added: number }>('/api/settings/departments', { sync: true, locationBranches, codes }),

  // Custodians
  getCustodians: () => api.get<unknown[]>('/api/settings/custodians'),
  createCustodian: (data: unknown) => api.post<unknown>('/api/settings/custodians', data),
  updateCustodian: (id: string, data: unknown) => api.put<unknown>(`/api/settings/custodians/${id}`, data),
  deleteCustodian: (id: string) => api.delete<unknown>(`/api/settings/custodians/${id}`),

  // Locations
  getLocations: () => api.get<unknown[]>('/api/settings/locations'),
  createLocation: (data: unknown) => api.post<unknown>('/api/settings/locations', data),
  updateLocation: (id: string, data: unknown) => api.put<unknown>(`/api/settings/locations/${id}`, data),
  deleteLocation: (id: string) => api.delete<unknown>(`/api/settings/locations/${id}`),

  // Categories
  getCategories: () => api.get<unknown[]>('/api/settings/categories'),
  createCategory: (data: unknown) => api.post<unknown>('/api/settings/categories', data),
  updateCategory: (id: string, data: unknown) => api.put<unknown>(`/api/settings/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete<unknown>(`/api/settings/categories/${id}`),

  // Asset Types
  getAssetTypes: (categoryId?: string) =>
    api.get<unknown[]>(`/api/settings/asset-types${categoryId ? `?categoryId=${categoryId}` : ''}`),
  createAssetType: (data: unknown) => api.post<unknown>('/api/settings/asset-types', data),
  updateAssetType: (id: string, data: unknown) => api.put<unknown>(`/api/settings/asset-types/${id}`, data),
  deleteAssetType: (id: string) => api.delete<unknown>(`/api/settings/asset-types/${id}`),

  // Asset Classes
  getAssetClasses: () => api.get<unknown[]>('/api/settings/asset-classes'),
  createAssetClass: (data: unknown) => api.post<unknown>('/api/settings/asset-classes', data),
  updateAssetClass: (id: string, data: unknown) => api.put<unknown>(`/api/settings/asset-classes/${id}`, data),
  deleteAssetClass: (id: string) => api.delete<unknown>(`/api/settings/asset-classes/${id}`),

  // Custodian Options
  createCustodianOption: (data: unknown) =>
    api.post<unknown>('/api/settings/asset-classes', data),
  updateCustodianOption: (id: string, data: unknown) =>
    api.put<unknown>(`/api/settings/asset-classes/${id}`, { ...data as object, isCustodianOption: true }),
  deleteCustodianOption: (id: string) =>
    api.delete<unknown>(`/api/settings/asset-classes/${id}`, { isCustodianOption: true }),
};
