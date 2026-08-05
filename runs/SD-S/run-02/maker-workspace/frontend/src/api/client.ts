export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkList {
  items: Bookmark[];
  total: number;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface CreateInput {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export type UpdateInput = Partial<CreateInput>;

export interface DeleteResult {
  id: string;
  undoToken: string;
  undoExpiresAt: string;
}

/** Error thrown for non-2xx responses, carrying the API's machine code + message. */
export class ApiError extends Error {
  code: string;
  status: number;
  /** Present on 409 duplicate responses. */
  existing?: Bookmark;

  constructor(status: number, code: string, message: string, existing?: Bookmark) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.existing = existing;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let body: { error?: string; message?: string; existing?: Bookmark } = {};
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(
      res.status,
      body.error ?? "error",
      body.message ?? res.statusText,
      body.existing,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ListParams {
  q?: string;
  tags?: string[];
  sort?: "recent" | "title";
  limit?: number;
  offset?: number;
}

export function listBookmarks(params: ListParams = {}): Promise<BookmarkList> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  for (const tag of params.tags ?? []) qs.append("tag", tag);
  if (params.sort) qs.set("sort", params.sort);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return request<BookmarkList>(`/bookmarks${query ? `?${query}` : ""}`);
}

export function createBookmark(input: CreateInput): Promise<Bookmark> {
  return request<Bookmark>("/bookmarks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBookmark(id: string, input: UpdateInput): Promise<Bookmark> {
  return request<Bookmark>(`/bookmarks/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteBookmark(id: string): Promise<DeleteResult> {
  return request<DeleteResult>(`/bookmarks/${id}`, { method: "DELETE" });
}

export function restoreBookmark(id: string): Promise<Bookmark> {
  return request<Bookmark>(`/bookmarks/${id}/restore`, { method: "POST" });
}

export function listTags(): Promise<{ tags: TagCount[] }> {
  return request<{ tags: TagCount[] }>("/tags");
}
