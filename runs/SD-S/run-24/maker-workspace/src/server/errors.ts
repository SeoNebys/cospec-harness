import type { ApiErrorCode } from '../shared/bookmark-types.js';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly existingBookmarkId?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The bookmark could not be found.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class DuplicateUrlError extends AppError {
  constructor(existingBookmarkId: number) {
    super(409, 'DUPLICATE_URL', 'This link is already saved.', undefined, existingBookmarkId);
  }
}
