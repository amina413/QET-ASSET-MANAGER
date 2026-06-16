import { api, clearCsrfToken } from './api-client';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'System Admin' | 'Asset Manager' | 'Custodian' | 'Auditor';
  lastLogin: string | null;
};

export const authService = {
  login: async (email: string, password: string) => {
    clearCsrfToken();
    const result = await api.post<SessionUser>('/api/auth/login', { email, password });
    clearCsrfToken();
    return result;
  },

  logout: async () => {
    const result = await api.post<{ message: string }>('/api/auth/logout', {});
    clearCsrfToken();
    return result;
  },

  me: () =>
    api.get<SessionUser>('/api/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ changed: boolean }>('/api/auth/change-password', { currentPassword, newPassword }),
};
