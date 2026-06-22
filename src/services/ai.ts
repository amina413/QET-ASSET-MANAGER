import { api } from './api-client';

export const aiService = {
  query: (params: {
    message: string;
    assetsSnapshot?: unknown[];
    images?: string[];
    documents?: { name: string; content: string; type: string }[];
  }) => api.post<{ text: string }>('/api/ai', params),
};
