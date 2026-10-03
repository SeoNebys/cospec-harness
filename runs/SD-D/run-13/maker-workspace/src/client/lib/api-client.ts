import type { ApiError } from '../../shared/api/types.js';

export class ApiClientError extends Error {
  constructor(public status: number, public payload: ApiError) { super(payload.message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  const response = await fetch(path, {
    ...init,
    headers,
  });
  if (!response.ok) throw new ApiClientError(response.status, await response.json() as ApiError);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
