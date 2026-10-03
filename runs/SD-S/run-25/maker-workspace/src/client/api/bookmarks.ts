import type {
  Bookmark,
  BookmarkInput,
  BookmarkList,
  BookmarkListQuery,
  DuplicateErrorResponse,
  ErrorResponse,
  FieldErrors,
  ReadingState,
  TagList,
} from '../../shared/contracts.js';

export interface ApiRequestOptions {
  signal?: AbortSignal;
}

interface ApiErrorOptions {
  status: number;
  code: string;
  fieldErrors?: FieldErrors;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: FieldErrors;

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
  }
}

export class DuplicateBookmarkApiError extends ApiError {
  readonly existingBookmark: Bookmark;

  constructor(response: DuplicateErrorResponse, status = 409) {
    super(response.error.message, {
      status,
      code: response.error.code,
    });
    this.name = 'DuplicateBookmarkApiError';
    this.existingBookmark = response.existingBookmark;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isDuplicateBookmarkError(
  error: unknown,
): error is DuplicateBookmarkApiError {
  return error instanceof DuplicateBookmarkApiError;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBookmark = (value: unknown): value is Bookmark =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.url === 'string' &&
  typeof value.title === 'string' &&
  typeof value.description === 'string' &&
  Array.isArray(value.tags) &&
  value.tags.every((tag) => typeof tag === 'string') &&
  (value.readingState === 'untracked' ||
    value.readingState === 'to_read' ||
    value.readingState === 'read') &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const asFieldErrors = (value: unknown): FieldErrors | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (!entries.every(([, message]) => typeof message === 'string')) return undefined;
  return Object.fromEntries(entries) as FieldErrors;
};

const asErrorResponse = (value: unknown): ErrorResponse | null => {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const { code, message, fieldErrors } = value.error;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  const parsedFieldErrors = asFieldErrors(fieldErrors);

  return {
    error: {
      code,
      message,
      ...(parsedFieldErrors !== undefined ? { fieldErrors: parsedFieldErrors } : {}),
    },
  };
};

const asDuplicateResponse = (value: unknown): DuplicateErrorResponse | null => {
  if (
    !isRecord(value) ||
    !isRecord(value.error) ||
    value.error.code !== 'DUPLICATE_URL' ||
    typeof value.error.message !== 'string' ||
    !isBookmark(value.existingBookmark)
  ) {
    return null;
  }

  return {
    error: {
      code: 'DUPLICATE_URL',
      message: value.error.message,
    },
    existingBookmark: value.existingBookmark,
  };
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ApiError('The server returned an invalid response.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
      cause,
    });
  }
}

/** Shared same-origin JSON transport used by the bookmark and metadata APIs. */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers,
    });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ApiError('The server could not be reached.', {
      status: 0,
      code: 'NETWORK_ERROR',
      cause,
    });
  }
  const body = await readJson(response);

  if (!response.ok) {
    const duplicate = asDuplicateResponse(body);
    if (response.status === 409 && duplicate !== null) {
      throw new DuplicateBookmarkApiError(duplicate, response.status);
    }

    const structured = asErrorResponse(body);
    throw new ApiError(
      structured?.error.message ||
        response.statusText ||
        `The request failed with status ${response.status}.`,
      {
        status: response.status,
        code: structured?.error.code ?? 'HTTP_ERROR',
        fieldErrors: structured?.error.fieldErrors,
      },
    );
  }

  if (body === undefined && response.status !== 204) {
    throw new ApiError('The server returned an empty response.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }

  return body as T;
}

const jsonRequest = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
  signal,
});

export async function listBookmarks(
  query: BookmarkListQuery = {},
  options: ApiRequestOptions = {},
): Promise<BookmarkList> {
  const parameters = new URLSearchParams();
  if (query.view !== undefined) parameters.set('view', query.view);
  if (query.query !== undefined && query.query !== '') parameters.set('query', query.query);
  for (const tag of query.tag ?? []) parameters.append('tag', tag);
  if (query.sort !== undefined) parameters.set('sort', query.sort);

  const suffix = parameters.size === 0 ? '' : `?${parameters.toString()}`;
  return requestJson<BookmarkList>(`/api/bookmarks${suffix}`, {
    signal: options.signal,
  });
}

export function createBookmark(
  input: BookmarkInput,
  options: ApiRequestOptions = {},
): Promise<Bookmark> {
  return requestJson<Bookmark>(
    '/api/bookmarks',
    jsonRequest('POST', input, options.signal),
  );
}

export function getBookmark(
  bookmarkId: string,
  options: ApiRequestOptions = {},
): Promise<Bookmark> {
  return requestJson<Bookmark>(`/api/bookmarks/${encodeURIComponent(bookmarkId)}`, {
    signal: options.signal,
  });
}

export function replaceBookmark(
  bookmarkId: string,
  input: BookmarkInput,
  options: ApiRequestOptions = {},
): Promise<Bookmark> {
  return requestJson<Bookmark>(
    `/api/bookmarks/${encodeURIComponent(bookmarkId)}`,
    jsonRequest('PUT', input, options.signal),
  );
}

export async function deleteBookmark(
  bookmarkId: string,
  options: ApiRequestOptions = {},
): Promise<void> {
  await requestJson<void>(`/api/bookmarks/${encodeURIComponent(bookmarkId)}`, {
    method: 'DELETE',
    signal: options.signal,
  });
}

export function updateBookmarkReadingState(
  bookmarkId: string,
  readingState: ReadingState,
  options: ApiRequestOptions = {},
): Promise<Bookmark> {
  return requestJson<Bookmark>(
    `/api/bookmarks/${encodeURIComponent(bookmarkId)}/reading-state`,
    jsonRequest('PATCH', { readingState }, options.signal),
  );
}

export function listTags(options: ApiRequestOptions = {}): Promise<TagList> {
  return requestJson<TagList>('/api/tags', { signal: options.signal });
}
