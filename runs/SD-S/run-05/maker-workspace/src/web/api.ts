// Typed client for the local API (contracts/api.md). US1 covers list + create;
// later stories extend this file.

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  existing?: Bookmark;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data as ApiErrorBody);
  return data as T;
}

export async function listBookmarks(
  opts: {
    q?: string;
    tag?: string;
    sort?: 'created_desc' | 'created_asc' | 'title_asc';
  } = {},
): Promise<Bookmark[]> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.tag) params.set('tag', opts.tag);
  params.set('sort', opts.sort ?? 'created_desc');
  const res = await fetch(`/api/bookmarks?${params.toString()}`);
  const data = await parse<{ bookmarks: Bookmark[] }>(res);
  return data.bookmarks;
}

export interface Tag {
  id: number;
  name: string;
  count: number;
}

export async function listTags(): Promise<Tag[]> {
  const res = await fetch('/api/tags');
  return (await parse<{ tags: Tag[] }>(res)).tags;
}

export async function renameTag(id: number, name: string): Promise<Tag[]> {
  const res = await fetch(`/api/tags/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return (await parse<{ tags: Tag[] }>(res)).tags;
}

export async function removeTag(id: number): Promise<Tag[]> {
  const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
  return (await parse<{ tags: Tag[] }>(res)).tags;
}

export interface BookmarkEdit {
  url?: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export async function updateBookmark(
  id: number,
  edit: BookmarkEdit,
): Promise<Bookmark> {
  const res = await fetch(`/api/bookmarks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(edit),
  });
  return parse<Bookmark>(res);
}

export function setBookmarkTags(id: number, tags: string[]): Promise<Bookmark> {
  return updateBookmark(id, { tags });
}

export async function deleteBookmark(
  id: number,
): Promise<{ id: number; undoToken: string }> {
  const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
  return parse<{ id: number; undoToken: string }>(res);
}

export async function undoDelete(id: number): Promise<Bookmark> {
  const res = await fetch(`/api/bookmarks/${id}/undo`, { method: 'POST' });
  return parse<Bookmark>(res);
}

export interface NewBookmark {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export async function createBookmark(input: NewBookmark): Promise<Bookmark> {
  const res = await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<Bookmark>(res);
}
