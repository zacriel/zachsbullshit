/**
 * Thin fetch wrapper. All requests share an origin with the API in
 * production; in dev, Vite proxies /api to the Express server.
 * The admin token is kept in memory + localStorage and sent as a Bearer.
 */

const TOKEN_KEY = 'hub_admin_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — auth still works for the session via header */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const resp = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });

  if (resp.status === 204) return undefined as T;
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ApiError(resp.status, (data as { error?: string }).error || `Request failed (${resp.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Uploads an image for a tile background; returns its served URL. */
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const resp = await fetch('/api/tiles/upload', {
    method: 'POST',
    body: fd, // browser sets multipart Content-Type + boundary
    headers,
    credentials: 'include',
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ApiError(resp.status, (data as { error?: string }).error || 'Upload failed');
  return (data as { url: string }).url;
}

/** Uploads any file for a download tile; returns an opaque handle + metadata. */
export async function uploadFile(file: File): Promise<{ file: string; filename: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const resp = await fetch('/api/tiles/upload-file', { method: 'POST', body: fd, headers, credentials: 'include' });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ApiError(resp.status, (data as { error?: string }).error || 'Upload failed');
  return data as { file: string; filename: string; size: number };
}

/** Fire-and-forget click tracking (never throws into the UI). */
export function trackClick(linkId: number): void {
  try {
    void request('/analytics/click', { method: 'POST', body: JSON.stringify({ linkId }) }).catch(
      () => {},
    );
  } catch {
    /* analytics disabled or offline — ignore */
  }
}
