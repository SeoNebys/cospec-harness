import type { Bookmark, BookmarkPage, CreateBookmarkInput, MetadataPreview, UpdateBookmarkInput } from "../../../shared/contracts/bookmarks.js";
import { api } from "../../lib/api.js";

export const bookmarkApi = {
  list(query = "") { return api<BookmarkPage>(`/bookmarks${query ? `?${query}` : ""}`); },
  get(id: number) { return api<Bookmark>(`/bookmarks/${id}`); },
  preview(url: string, signal?: AbortSignal) { return api<MetadataPreview>("/metadata/preview", { method: "POST", body: JSON.stringify({ url }), ...(signal ? { signal } : {}) }); },
  create(input: CreateBookmarkInput) { return api<Bookmark>("/bookmarks", { method: "POST", body: JSON.stringify(input) }); },
  update(id: number, input: UpdateBookmarkInput) { return api<Bookmark>(`/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify(input) }); },
  favorite(id: number, value: boolean) { return api<Bookmark>(`/bookmarks/${id}/favorite`, { method: value ? "PUT" : "DELETE", body: "{}" }); },
  remove(id: number) { return api<void>(`/bookmarks/${id}`, { method: "DELETE", body: "{}" }); },
  retry(id: number) { return api(`/bookmarks/${id}/metadata/retry`, { method: "POST", body: "{}" }); }
};
