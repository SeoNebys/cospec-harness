import {
  bookmarkListResponseSchema,
  bookmarkSchema,
  tagSummarySchema,
} from '../shared/bookmark-schema.js';
import type {
  ApiErrorBody,
  ApiErrorCode,
  Bookmark,
  BookmarkListResponse,
  BookmarkQuery,
  CreateBookmarkInput,
  TagSummary,
  UpdateBookmarkInput,
} from '../shared/bookmark-types.js';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly existingBookmarkId?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json()) as ApiErrorBody;
    throw new ApiClientError(
      body.error.message,
      body.error.code,
      body.error.fieldErrors,
      body.error.existingBookmarkId,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const listBookmarks = async (
  query?: Partial<BookmarkQuery>,
): Promise<BookmarkListResponse> => {
  const parameters = new URLSearchParams();
  if (query?.q) parameters.set('q', query.q);
  if (query?.tags?.length) parameters.set('tags', query.tags.join(','));
  if (query?.favorite !== undefined) parameters.set('favorite', String(query.favorite));
  if (query?.archived) parameters.set('archived', 'true');
  if (query?.sort && query.sort !== 'newest') parameters.set('sort', query.sort);
  const suffix = parameters.size ? `?${parameters.toString()}` : '';
  return bookmarkListResponseSchema.parse(await request<unknown>(`/api/bookmarks${suffix}`));
};

export const getBookmark = async (id: number): Promise<Bookmark> =>
  bookmarkSchema.parse(await request<unknown>(`/api/bookmarks/${id}`));

export const createBookmark = async (input: CreateBookmarkInput): Promise<Bookmark> =>
  bookmarkSchema.parse(
    await request<unknown>('/api/bookmarks', { method: 'POST', body: JSON.stringify(input) }),
  );

export const updateBookmark = async (id: number, input: UpdateBookmarkInput): Promise<Bookmark> =>
  bookmarkSchema.parse(
    await request<unknown>(`/api/bookmarks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );

export const deleteBookmark = async (id: number): Promise<void> =>
  request<void>(`/api/bookmarks/${id}`, { method: 'DELETE' });

export const listTags = async (archived = false): Promise<TagSummary[]> => {
  const result = (await request<unknown>(`/api/tags${archived ? '?archived=true' : ''}`)) as {
    items: unknown[];
  };
  return result.items.map((item) => tagSummarySchema.parse(item));
};
