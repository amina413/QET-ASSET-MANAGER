export type ApiResult<T> = { success: true; data: T } | { success: false; error: string; details?: unknown };

const TIMEOUT_MS = 30_000;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

let cachedCsrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const json = await res.json() as ApiResult<{ csrfToken: string }>;
    if (json.success) {
      cachedCsrfToken = json.data.csrfToken;
      return cachedCsrfToken;
    }
  } catch {
    // Network/parse failure — the mutating request below will be sent without
    // a token and rejected by the server with a clear 403 instead of hanging.
  }
  return null;
}

async function parseResponse<T>(res: Response): Promise<ApiResult<T>> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return await res.json() as ApiResult<T>;
  }

  const text = await res.text().catch(() => '');
  return {
    success: false,
    error: text || `Request failed with status ${res.status}`,
  };
}

async function apiFetch<T>(path: string, options?: RequestInit, retriedCsrf = false): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const method = (options?.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string> | undefined) };

    if (MUTATING_METHODS.has(method)) {
      if (!cachedCsrfToken) await fetchCsrfToken();
      if (cachedCsrfToken) headers['X-CSRF-Token'] = cachedCsrfToken;
    }

    const res = await fetch(path, {
      ...options,
      headers,
      credentials: 'same-origin',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.status === 401) {
      clearCsrfToken();
      unauthorizedHandler?.();
    }

    if (res.status === 403 && MUTATING_METHODS.has(method) && !retriedCsrf) {
      clearCsrfToken();
      return apiFetch<T>(path, options, true);
    }

    const result = await parseResponse<T>(res);
    if (!res.ok && result.success) {
      return { success: false, error: `Request failed with status ${res.status}` };
    }
    return result;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
};
