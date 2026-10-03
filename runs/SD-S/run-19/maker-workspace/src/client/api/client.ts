import type { Bookmark, BookmarkListResponse, DuplicateError, ErrorEnvelope, MetadataPreview, TagListResponse } from '../../shared/types.js';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly field?: string,
    public readonly duplicates: Bookmark[] = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json() as T | ErrorEnvelope | DuplicateError;
  if (!response.ok) {
    const errorBody = body as ErrorEnvelope & Partial<DuplicateError>;
    throw new ApiClientError(
      errorBody.error?.message ?? 'The request could not be completed.',
      response.status,
      errorBody.error?.code ?? 'INTERNAL_ERROR',
      errorBody.error?.field,
      errorBody.duplicates ?? [],
    );
  }
  return body as T;
}

export function previewMetadata(url: string): Promise<MetadataPreview> {
  return requestJson('/api/metadata', { method: 'POST', body: JSON.stringify({ url }) });
}

export interface BookmarkDraft {
  url: string;
  title: string;
  description: string | null;
  tags: string[];
  allowDuplicate?: boolean;
}

export function createBookmark(draft: BookmarkDraft): Promise<Bookmark> {
  return requestJson('/api/bookmarks', { method: 'POST', body: JSON.stringify(draft) });
}

export function listBookmarks(query = '', tag = ''): Promise<BookmarkListResponse> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (tag.trim()) params.set('tag', tag.trim());
  const suffix = params.size ? `?${params.toString()}` : '';
  return requestJson(`/api/bookmarks${suffix}`);
}

export function listTags(): Promise<TagListResponse> {
  return requestJson('/api/tags');
}

export function updateBookmark(id: number, draft: Partial<BookmarkDraft>): Promise<Bookmark> {
  return requestJson(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(draft) });
}

export function deleteBookmark(id: number): Promise<void> {
  return requestJson(`/api/bookmarks/${id}`, { method: 'DELETE' });
}
