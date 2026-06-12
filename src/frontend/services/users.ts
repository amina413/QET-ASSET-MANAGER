import { api } from './api-client';

export type DbUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  lastLogin: string;
  createdAt: string;
};

export const userService = {
  getAll: () => api.get<DbUser[]>('/api/users'),

  create: (data: { name: string; email: string; password: string; department: string; role: string }) =>
    api.post<DbUser>('/api/users', data),

  update: (id: string, data: Partial<{ name: string; department: string; role: string; password: string }>) =>
    api.put<DbUser>(`/api/users/${id}`, data),

  delete: (id: string) =>
    api.delete<{ deleted: boolean }>(`/api/users/${id}`),
};
