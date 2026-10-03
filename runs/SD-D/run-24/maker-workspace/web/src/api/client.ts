import type {
  Bookmark,
  DisplayPreferences,
  ListResult,
  PageMetadata,
  SavedFilter,
  SortOrder,
  ViewName,
} from '../types';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message || 'Request failed';
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
  }
}

export interface ListParams {
  q?: string;
  tag?: string;
  filterId?: number;
  view?: ViewName;
  sort?: SortOrder;
  page?: number;
  pageSize?: number;
}

export function listBookmarks(params: ListParams): Promise<ListResult> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  return req<ListResult>(`/api/bookmarks?${qs.toString()}`);
}

export function getMetadata(url: string): Promise<PageMetadata> {
  return req<PageMetadata>(`/api/metadata?url=${encodeURIComponent(url)}`);
}

export function createBookmark(input: {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  note_markdown?: string;
}): Promise<{ bookmark: Bookmark; duplicate: boolean }> {
  return req(`/api/bookmarks`, { method: 'POST', body: JSON.stringify(input) });
}

export function getBookmark(id: number): Promise<Bookmark> {
  return req<Bookmark>(`/api/bookmarks/${id}`);
}

export function updateBookmark(id: number, patch: Partial<Bookmark> & { tags?: string[] }): Promise<Bookmark> {
  return req<Bookmark>(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteBookmark(id: number): Promise<void> {
  return req<void>(`/api/bookmarks/${id}`, { method: 'DELETE' });
}

export interface BulkTarget {
  ids?: number[];
  allMatching?: ListParams;
}
export function bulkAction(
  target: BulkTarget,
  action: string,
  payload?: { tags?: string[] },
  confirm?: boolean
): Promise<{ affected: number }> {
  return req(`/api/bookmarks/bulk`, {
    method: 'POST',
    body: JSON.stringify({ target, action, payload, confirm }),
  });
}

export function refreshArchiveCopy(id: number): Promise<{ wayback_url: string | null; requested: boolean }> {
  return req(`/api/bookmarks/${id}/archive-copy/refresh`, { method: 'POST' });
}

export function suggestTags(query: string): Promise<{ tags: string[] }> {
  return req(`/api/tags?query=${encodeURIComponent(query)}`);
}

export function listTags(): Promise<{ tags: { id: number; name: string }[] }> {
  return req(`/api/tags`);
}

export function listFilters(): Promise<{ filters: SavedFilter[] }> {
  return req(`/api/filters`);
}
export function createFilter(input: {
  name: string;
  search_expression?: string;
  includedTagIds?: number[];
  excludedTagIds?: number[];
}): Promise<SavedFilter> {
  return req(`/api/filters`, { method: 'POST', body: JSON.stringify(input) });
}
export function deleteFilter(id: number): Promise<void> {
  return req<void>(`/api/filters/${id}`, { method: 'DELETE' });
}

export function getPreferences(): Promise<DisplayPreferences> {
  return req<DisplayPreferences>(`/api/preferences`);
}
export function updatePreferences(p: Partial<DisplayPreferences>): Promise<DisplayPreferences> {
  return req<DisplayPreferences>(`/api/preferences`, { method: 'PUT', body: JSON.stringify(p) });
}
