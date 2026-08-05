/** Typed client for the local backend API (contracts/api.md). */

export interface Bookmark {
  id: number;
  url: string;
  normalized_url: string;
  title: string;
  description: string;
  notes: string;
  icon_ref: string | null;
  preview_ref: string | null;
  read_state: 'to_read' | 'read';
  archived: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface Preferences {
  default_sort: 'newest' | 'oldest' | 'title';
  text_size: 'normal' | 'large';
  archive_optin: boolean;
}

export interface SavedSearch {
  id: number;
  name: string;
  query: string;
  created_at: string;
}

export type BulkAction =
  | 'add-tag' | 'remove-tag' | 'mark-read' | 'mark-to-read'
  | 'archive' | 'unarchive' | 'delete';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export interface ListParams {
  sort?: 'newest' | 'oldest' | 'title';
  read_state?: 'to_read' | 'read';
  archived?: boolean;
  tag?: string;
  q?: string;
}

export const api = {
  list(params: ListParams = {}): Promise<{ bookmarks: Bookmark[] }> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    return req(`/bookmarks?${qs.toString()}`);
  },
  search(q: string, archived = false): Promise<{ bookmarks: Bookmark[] }> {
    return req(`/search?q=${encodeURIComponent(q)}&archived=${archived}`);
  },
  create(input: { url: string; title?: string; description?: string; tags?: string[] }): Promise<{ bookmark: Bookmark; deduped: boolean }> {
    return req(`/bookmarks`, { method: 'POST', body: JSON.stringify(input) });
  },
  get(id: number): Promise<{ bookmark: Bookmark }> {
    return req(`/bookmarks/${id}`);
  },
  update(id: number, fields: Partial<Bookmark>): Promise<{ bookmark: Bookmark }> {
    return req(`/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
  },
  remove(id: number): Promise<void> {
    return req(`/bookmarks/${id}`, { method: 'DELETE' });
  },
  bulk(body: { ids?: number[]; matchQuery?: string; archivedScope?: boolean; action: BulkAction; tag?: string }): Promise<{ affected: number }> {
    return req(`/bookmarks/bulk`, { method: 'POST', body: JSON.stringify(body) });
  },
  tags(prefix: string): Promise<{ tags: string[] }> {
    return req(`/tags?prefix=${encodeURIComponent(prefix)}`);
  },
  snapshotStatus(id: number): Promise<{ status: string; kind: string | null; archive_url: string | null }> {
    return req(`/bookmarks/${id}/snapshot/status`);
  },
  snapshotUrl(id: number): string {
    return `/api/bookmarks/${id}/snapshot`;
  },
  savedSearches(): Promise<{ savedSearches: SavedSearch[] }> {
    return req(`/saved-searches`);
  },
  saveSearch(name: string, query: string): Promise<{ savedSearch: SavedSearch }> {
    return req(`/saved-searches`, { method: 'POST', body: JSON.stringify({ name, query }) });
  },
  deleteSavedSearch(id: number): Promise<void> {
    return req(`/saved-searches/${id}`, { method: 'DELETE' });
  },
  preferences(): Promise<{ preferences: Preferences }> {
    return req(`/preferences`);
  },
  updatePreferences(fields: Partial<Preferences>): Promise<{ preferences: Preferences }> {
    return req(`/preferences`, { method: 'PATCH', body: JSON.stringify(fields) });
  },
  importContent(content: string): Promise<{ added: number; duplicates: number; total: number }> {
    return req(`/import`, { method: 'POST', body: JSON.stringify({ content }) });
  },
  exportUrl: '/api/export',
  backupUrl: '/api/backup',
  restore(backup: unknown): Promise<{ restored: number; skipped: number }> {
    return req(`/restore`, { method: 'POST', body: JSON.stringify(backup) });
  },
};
