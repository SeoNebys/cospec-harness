import type {
  Bookmark,
  BookmarkCreate,
  BookmarkUpdate,
  Collection,
  MetadataProposal
} from '@shared/contracts.js';
import { api, jsonBody } from './api.js';
export type BookmarkPage = {
  items: Bookmark[];
  total: number;
  queryFingerprint: string;
  counts: { active: number; unread: number; archive: number };
};
export const previewMetadata = (url: string, signal?: AbortSignal) =>
  api<MetadataProposal>('/api/metadata/preview', {
    method: 'POST',
    body: jsonBody({ url }),
    signal
  });
export const createBookmark = (value: BookmarkCreate) =>
  api<Bookmark>('/api/bookmarks', { method: 'POST', body: jsonBody(value) });
export const listBookmarks = (params: {
  collection: Collection;
  q?: string;
  tag?: string;
  sort?: string;
  offset?: number;
}) =>
  api<BookmarkPage>(
    `/api/bookmarks?${new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )}`
  );
export const getBookmark = (id: string) => api<Bookmark>(`/api/bookmarks/${id}`);
export const updateBookmark = (id: string, value: BookmarkUpdate) =>
  api<Bookmark>(`/api/bookmarks/${id}`, { method: 'PATCH', body: jsonBody(value) });
export const deleteBookmark = (id: string) =>
  api<void>(`/api/bookmarks/${id}?confirm=permanent`, { method: 'DELETE' });
export const refreshMetadata = (id: string) =>
  api<MetadataProposal>(`/api/bookmarks/${id}/metadata-preview`, { method: 'POST', body: '{}' });
export const listTags = () =>
  api<{ items: { id: string; name: string; count: number }[] }>('/api/tags');
export const bulkBookmarks = (value: unknown) =>
  api<{ matched: number; changed: number; unchanged: number }>('/api/bookmarks/bulk', {
    method: 'POST',
    body: jsonBody(value)
  });
