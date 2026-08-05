// Shared error type + JSON shape used by all routes, per contracts/api.md.
// Every API error serializes to { error, message } with an HTTP status so the
// UI can show specific, helpful guidance (FR-002, FR-015).

export type ErrorCode = 'invalid_url' | 'duplicate' | 'not_found' | 'gone';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toBody(): Record<string, unknown> {
    return { error: this.code, message: this.message, ...this.extra };
  }
}

export const invalidUrl = (message: string) =>
  new ApiError(400, 'invalid_url', message);

export const duplicate = (message: string, existing: unknown) =>
  new ApiError(409, 'duplicate', message, { existing });

export const notFound = (message = 'Bookmark not found') =>
  new ApiError(404, 'not_found', message);
