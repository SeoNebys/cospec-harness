// Thin client for the local Bookmark Manager API (contracts/api.md).

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  faviconUrl: string | null;
  noteHtml: string | null;
  tags: string[];
  dateSaved: string;
  dateModified: string;
}

export interface BookmarkList {
  items: Bookmark[];
  total: number;
}

export type Sort = "recent" | "title";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function parseError(resp: Response): Promise<ApiError> {
  try {
    const body = await resp.json();
    const err = body?.error;
    if (err?.message) return new ApiError(err.code ?? "error", err.message);
  } catch {
    // fall through
  }
  return new ApiError("error", `Request failed (${resp.status})`);
}

export interface ListParams {
  q?: string;
  tag?: string;
  sort?: Sort;
}

export async function listBookmarks(params: ListParams = {}): Promise<BookmarkList> {
  const search = new URLSearchParams();
  search.set("sort", params.sort ?? "recent");
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.tag?.trim()) search.set("tag", params.tag.trim());

  const resp = await fetch(`/api/bookmarks?${search.toString()}`);
  if (!resp.ok) throw await parseError(resp);
  return resp.json();
}

export interface UpdateFields {
  url?: string;
  title?: string;
  noteHtml?: string;
  tags?: string[];
}

export async function updateBookmark(id: number, fields: UpdateFields): Promise<Bookmark> {
  const resp = await fetch(`/api/bookmarks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!resp.ok) throw await parseError(resp);
  return resp.json();
}

export async function deleteBookmark(id: number): Promise<void> {
  const resp = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
  if (!resp.ok && resp.status !== 204) throw await parseError(resp);
}

export interface TagCount {
  name: string;
  count: number;
}

export async function listTags(): Promise<TagCount[]> {
  const resp = await fetch("/api/tags");
  if (!resp.ok) throw await parseError(resp);
  return resp.json();
}

export async function suggestTags(prefix: string): Promise<string[]> {
  const resp = await fetch(`/api/tags/suggest?prefix=${encodeURIComponent(prefix)}`);
  if (!resp.ok) throw await parseError(resp);
  return resp.json();
}

export interface ImportResult {
  added: number;
  skipped: number;
}

export async function importBookmarks(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch("/api/import", { method: "POST", body: form });
  if (!resp.ok) throw await parseError(resp);
  return resp.json();
}

export interface CreateResult {
  bookmark: Bookmark;
  duplicate: boolean;
}

export async function createBookmark(url: string): Promise<CreateResult> {
  const resp = await fetch("/api/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) throw await parseError(resp);

  const body = await resp.json();
  // 200 with {bookmark, duplicate:true} vs 201 with the bookmark itself.
  if (body.duplicate) {
    return { bookmark: body.bookmark, duplicate: true };
  }
  return { bookmark: body, duplicate: false };
}
