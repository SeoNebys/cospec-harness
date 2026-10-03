export interface Bookmark {
  id: string;
  url: string;
  title: string;
  titleCaptured: string | null;
  titleUser: string | null;
  description: string;
  descriptionCaptured: string | null;
  descriptionUser: string | null;
  note: string | null;
  favicon: string | null;
  previewImage: string | null;
  unread: boolean;
  archived: boolean;
  tags: string[];
  snapshotKind: 'html' | 'pdf' | null;
  hasSnapshot: boolean;
  archiveOrgUrl: string | null;
  captureStatus: { metadata?: string; snapshot?: string };
  dateAdded: string;
  dateModified: string;
}

export interface ListResult {
  items: Bookmark[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SavedView {
  id: number;
  name: string;
  query: string;
  includeTags: string[];
  excludeTags: string[];
  dateCreated: string;
}

export interface Preferences {
  defaultSort: string;
  itemsShown: number;
  textSize: string;
}

export interface TagCount {
  name: string;
  count: number;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return null as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error?.message ?? `Request failed (${res.status})`) as Error & {
      status: number;
      details?: unknown;
    };
    err.status = res.status;
    err.details = data?.error?.details;
    throw err;
  }
  return data as T;
}

export interface ListParams {
  q?: string;
  tag?: string[];
  view?: number;
  scope?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export function buildListQuery(p: ListParams): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.view != null) sp.set('view', String(p.view));
  if (p.scope) sp.set('scope', p.scope);
  if (p.sort) sp.set('sort', p.sort);
  if (p.page) sp.set('page', String(p.page));
  if (p.pageSize) sp.set('pageSize', String(p.pageSize));
  for (const t of p.tag ?? []) sp.append('tag', t);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  list: (p: ListParams) => req<ListResult>(`/api/bookmarks${buildListQuery(p)}`),
  get: (id: string) => req<Bookmark>(`/api/bookmarks/${id}`),
  create: (body: Record<string, unknown>) =>
    req<Bookmark>('/api/bookmarks', { method: 'POST', body: JSON.stringify(body) }),
  patch: (id: string, body: Record<string, unknown>) =>
    req<Bookmark>(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => req<null>(`/api/bookmarks/${id}`, { method: 'DELETE' }),
  bulk: (selector: unknown, action: unknown) =>
    req<{ affected: number }>('/api/bookmarks/bulk', {
      method: 'POST',
      body: JSON.stringify({ selector, action }),
    }),
  archiveOrg: (id: string) =>
    req<{ archiveOrgUrl: string }>(`/api/bookmarks/${id}/archive-org`, { method: 'POST' }),
  tags: (prefix?: string) =>
    req<{ tags: TagCount[] }>(`/api/tags${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`),
  views: () => req<{ views: SavedView[] }>('/api/views'),
  createView: (body: Record<string, unknown>) =>
    req<SavedView>('/api/views', { method: 'POST', body: JSON.stringify(body) }),
  updateView: (id: number, body: Record<string, unknown>) =>
    req<SavedView>(`/api/views/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteView: (id: number) => req<null>(`/api/views/${id}`, { method: 'DELETE' }),
  preferences: () => req<Preferences>('/api/preferences'),
  updatePreferences: (body: Record<string, unknown>) =>
    req<Preferences>('/api/preferences', { method: 'PATCH', body: JSON.stringify(body) }),
};
