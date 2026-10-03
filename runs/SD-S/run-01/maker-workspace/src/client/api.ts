import type { ApiErrorEnvelope, BookmarkEnvelope, BookmarkList, CreateBookmarkInput, ListCriteria, UpdateBookmarkInput } from '../shared/api-types';

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: ApiErrorEnvelope;

  constructor(status: number, body: ApiErrorEnvelope) {
    super(body.error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    let body: ApiErrorEnvelope;
    try {
      body = (await response.json()) as ApiErrorEnvelope;
    } catch {
      body = { error: { code: 'NETWORK_ERROR', message: 'The request could not be completed.' } };
    }
    throw new ApiClientError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function bookmarkQuery(criteria: ListCriteria): string {
  const parameters = new URLSearchParams({ scope: criteria.scope, sort: criteria.sort });
  if (criteria.q) parameters.set('q', criteria.q);
  if (criteria.tag) parameters.set('tag', criteria.tag);
  if (criteria.favorite !== null) parameters.set('favorite', String(criteria.favorite));
  return parameters.toString();
}

export const bookmarkApi = {
  list: (criteria: ListCriteria) => apiRequest<BookmarkList>(`/bookmarks?${bookmarkQuery(criteria)}`),
  create: (input: CreateBookmarkInput) => apiRequest<BookmarkEnvelope>('/bookmarks', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateBookmarkInput) => apiRequest<BookmarkEnvelope>(`/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  archive: (id: string) => apiRequest<BookmarkEnvelope>(`/bookmarks/${id}/archive`, { method: 'POST' }),
  restore: (id: string) => apiRequest<BookmarkEnvelope>(`/bookmarks/${id}/restore`, { method: 'POST' }),
  delete: (id: string) => apiRequest<void>(`/bookmarks/${id}`, { method: 'DELETE' }),
};
