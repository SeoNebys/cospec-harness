import type { z } from 'zod';
import { ErrorEnvelopeSchema, type ApiError } from '@shared/contracts/api';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly detail: ApiError,
  ) {
    super(detail.message);
    this.name = 'ApiClientError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    const parsed = ErrorEnvelopeSchema.safeParse(payload);
    const detail: ApiError = parsed.success
      ? parsed.data.error
      : { code: 'HTTP_ERROR', message: `The request failed (${response.status}).` };
    throw new ApiClientError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return schema.parse(await response.json());
}
