import type {
  Bookmark,
  BookmarkInput,
  BookmarkStatus,
  Tag,
} from '../../../shared/contracts/bookmarks';
import { api } from '../../api/client';

export type TagSummary = Tag & { bookmarkCount: number };
export const listBookmarks = (params: URLSearchParams) =>
  api<{ items: Bookmark[]; nextCursor: string | null }>(`/bookmarks?${params}`);
export const listTags = (view: BookmarkStatus) =>
  api<{ items: TagSummary[] }>(`/tags?view=${view}`);
export const createBookmark = (input: BookmarkInput) =>
  api<Bookmark>('/bookmarks', { method: 'POST', body: JSON.stringify(input) });
export const updateBookmark = (id: string, input: BookmarkInput) =>
  api<Bookmark>(`/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const favoriteBookmark = (id: string, isFavorite: boolean) =>
  api<Bookmark>(`/bookmarks/${id}/favorite`, {
    method: 'PUT',
    body: JSON.stringify({ isFavorite }),
  });
export const archiveBookmark = (id: string) =>
  api<Bookmark>(`/bookmarks/${id}/archive`, { method: 'POST' });
export const restoreBookmark = (id: string) =>
  api<Bookmark>(`/bookmarks/${id}/restore`, { method: 'POST' });
export const deleteBookmark = (id: string) => api<void>(`/bookmarks/${id}`, { method: 'DELETE' });
