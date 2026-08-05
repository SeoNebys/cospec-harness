import type { Bookmark, BookmarkDraft, Tag } from "./types.ts";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function fetchBookmarks(params: {
  search?: string;
  tag?: string;
}): Promise<Bookmark[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.tag) qs.set("tag", params.tag);
  const q = qs.toString();
  return request<Bookmark[]>(`/api/bookmarks${q ? `?${q}` : ""}`);
}

export function fetchTags(): Promise<Tag[]> {
  return request<Tag[]>("/api/tags");
}

export function createBookmark(draft: BookmarkDraft): Promise<Bookmark> {
  return request<Bookmark>("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function updateBookmark(
  id: number,
  draft: BookmarkDraft
): Promise<Bookmark> {
  return request<Bookmark>(`/api/bookmarks/${id}`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export function deleteBookmark(id: number): Promise<void> {
  return request<void>(`/api/bookmarks/${id}`, { method: "DELETE" });
}

export async function fetchTitle(url: string): Promise<string> {
  const { title } = await request<{ title: string }>("/api/fetch-title", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  return title;
}
