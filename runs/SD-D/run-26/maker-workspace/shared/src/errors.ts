export const errorCodes = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE',
  'QUERY_INVALID',
  'METADATA_BLOCKED',
  'METADATA_UNAVAILABLE',
  'TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR'
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}
