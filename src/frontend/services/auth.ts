import { api } from './api-client';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'System Admin' | 'Asset Manager' | 'Custodian' | 'Auditor';
};

export const authService = {
  login: (email: string, password: string) =>
    api.post<SessionUser>('/api/auth/login', { email, password }),

  logout: () =>
    api.post<{ message: string }>('/api/auth/logout', {}),

  me: () =>
    api.get<SessionUser>('/api/auth/me'),
};
