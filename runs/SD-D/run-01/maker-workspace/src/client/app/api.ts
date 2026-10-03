export class ApiClientError extends Error {
  constructor(message: string, public code: string, public status: number, public field?: string, public existingId?: string) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');
  const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: 'Request failed.', code: 'REQUEST_ERROR' } }));
    throw new ApiClientError(body.error?.message ?? 'Request failed.', body.error?.code ?? 'REQUEST_ERROR', response.status, body.error?.field, body.error?.existingId);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
