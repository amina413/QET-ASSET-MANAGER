export type ApiResult<T> = { success: true; data: T } | { success: false; error: string; details?: unknown };

async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      credentials: 'same-origin',
    });
    const json = await res.json() as ApiResult<T>;
    return json;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
};
