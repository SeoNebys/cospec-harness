import { ApiError } from './errors';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
    credentials: 'same-origin',
  });
  const type = response.headers.get('content-type') ?? '';
  const body = type.includes('json') ? ((await response.json()) as Record<string, unknown>) : null;
  if (!response.ok)
    throw new ApiError(
      response.status,
      String(body?.code ?? 'REQUEST_ERROR'),
      String(body?.message ?? 'The request failed.'),
      body,
    );
  return body as T;
}

export const jsonBody = (value: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(value) });
