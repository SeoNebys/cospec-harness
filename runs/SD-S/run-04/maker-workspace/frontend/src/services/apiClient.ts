import type { Bookmark, Tag } from "../types";

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

/** Error thrown by the API client, carrying the server's error code + payload. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorShape) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: ApiErrorShape }).error ?? {
      code: "UNKNOWN",
      message: "Request failed",
    };
    throw new ApiError(res.status, err);
  }
  return body as T;
}

export interface CreateBookmarkInput {
  url: string;
  title?: string;
  note?: string;
  tags?: string[];
  allowDuplicate?: boolean;
}

export interface UpdateBookmarkInput {
  title?: string;
  note?: string;
  tags?: string[];
}

export const api = {
  listBookmarks(params?: { q?: string; tag?: string }): Promise<{ bookmarks: Bookmark[] }> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.tag) qs.set("tag", params.tag);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/bookmarks${suffix}`);
  },

  getBookmark(id: number): Promise<{ bookmark: Bookmark }> {
    return request(`/bookmarks/${id}`);
  },

  createBookmark(input: CreateBookmarkInput): Promise<{ bookmark: Bookmark }> {
    return request(`/bookmarks`, { method: "POST", body: JSON.stringify(input) });
  },

  updateBookmark(id: number, input: UpdateBookmarkInput): Promise<{ bookmark: Bookmark }> {
    return request(`/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  },

  deleteBookmark(id: number): Promise<void> {
    return request(`/bookmarks/${id}`, { method: "DELETE" });
  },

  listTags(): Promise<{ tags: (Tag & { count: number })[] }> {
    return request(`/tags`);
  },
};
