// Typed client for the backend API (contracts/api.md).

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  icon: string | null;
  description: string | null;
  notes: string | null;
  date_added: string;
  is_read: boolean;
  is_archived: boolean;
  tags: string[];
  existing?: boolean;
}

export interface BookmarkList {
  items: Bookmark[];
  count: number;
}

export interface SaveResult {
  bookmark: Bookmark;
  /** true when the URL was already saved and the existing one was returned */
  existing: boolean;
}

export type SortOrder = "recent" | "title";

export interface Filters {
  q?: string;
  tagsAny?: string[];
  tagsNot?: string[];
  sort?: SortOrder;
  unread?: boolean;
  archived?: boolean;
}

export class ApiError extends Error {}

export async function saveBookmark(url: string): Promise<SaveResult> {
  const resp = await fetch("/api/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (resp.status === 422) {
    const body = await resp.json().catch(() => ({}));
    throw new ApiError(body.detail ?? "That doesn't look like a valid web address.");
  }
  if (!resp.ok) {
    throw new ApiError("Could not save the bookmark. Please try again.");
  }
  const bookmark: Bookmark = await resp.json();
  return { bookmark, existing: Boolean(bookmark.existing) };
}

export async function listBookmarks(filters: Filters = {}): Promise<BookmarkList> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  (filters.tagsAny ?? []).forEach((t) => params.append("tags_any", t));
  (filters.tagsNot ?? []).forEach((t) => params.append("tags_not", t));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.unread) params.set("unread", "true");
  if (filters.archived) params.set("archived", "true");
  const resp = await fetch(`/api/bookmarks?${params.toString()}`);
  if (!resp.ok) {
    throw new ApiError("Could not load your bookmarks.");
  }
  return resp.json();
}

export interface BookmarkPatch {
  title?: string;
  description?: string | null;
  notes?: string | null;
  tags?: string[];
  is_read?: boolean;
  is_archived?: boolean;
}

export async function updateBookmark(id: number, patch: BookmarkPatch): Promise<Bookmark> {
  const resp = await fetch(`/api/bookmarks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!resp.ok) {
    throw new ApiError("Could not save your changes.");
  }
  return resp.json();
}

export async function deleteBookmark(id: number): Promise<void> {
  const resp = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
  if (!resp.ok) {
    throw new ApiError("Could not delete the bookmark.");
  }
}

export interface ImportResult {
  imported: number;
  skipped_duplicates: number;
}

export async function importBookmarks(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch("/api/import", { method: "POST", body: form });
  if (!resp.ok) {
    throw new ApiError("Could not import that file.");
  }
  return resp.json();
}

/** URL for downloading an export in the given format. */
export function exportUrl(format: "html" | "json"): string {
  return `/api/export?format=${format}`;
}

export interface BulkFilter {
  q?: string;
  tags_any?: string[];
  tags_not?: string[];
  unread?: boolean;
  archived?: boolean;
}

export type BulkActionType =
  | "add_tag"
  | "remove_tag"
  | "archive"
  | "unarchive"
  | "mark_read"
  | "mark_unread"
  | "delete";

export async function bulkAction(
  target: { ids?: number[]; filter?: BulkFilter },
  action: { type: BulkActionType; tag?: string; confirm?: boolean }
): Promise<{ affected: number }> {
  const resp = await fetch("/api/bookmarks/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, action }),
  });
  if (!resp.ok) {
    throw new ApiError("Could not apply that action to the selected bookmarks.");
  }
  return resp.json();
}

export interface SavedSearch {
  id: number;
  name: string;
  keyword: string | null;
  include_tags: string[];
  exclude_tags: string[];
  unread_only: boolean;
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const resp = await fetch("/api/saved-searches");
  if (!resp.ok) return [];
  return resp.json();
}

export async function createSavedSearch(input: {
  name: string;
  keyword?: string;
  include_tags: string[];
  exclude_tags: string[];
  unread_only: boolean;
}): Promise<SavedSearch> {
  const resp = await fetch("/api/saved-searches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (resp.status === 409) throw new ApiError("You already have a saved search with that name.");
  if (!resp.ok) throw new ApiError("Could not save that search.");
  return resp.json();
}

export async function deleteSavedSearch(id: number): Promise<void> {
  await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
}

export async function fetchTags(opts: { prefix?: string; inUse?: boolean } = {}): Promise<
  string[]
> {
  const params = new URLSearchParams();
  if (opts.prefix) params.set("prefix", opts.prefix);
  if (opts.inUse) params.set("in_use", "true");
  const resp = await fetch(`/api/tags?${params.toString()}`);
  if (!resp.ok) return [];
  return resp.json();
}
