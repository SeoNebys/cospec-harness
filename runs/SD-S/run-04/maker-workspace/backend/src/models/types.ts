export type FetchStatus = "pending" | "success" | "failed";

/** A saved web link (data-model.md). */
export interface Bookmark {
  id: number;
  url: string;
  normalizedUrl: string;
  title: string | null;
  note: string | null;
  previewDescription: string | null;
  previewImageUrl: string | null;
  fetchStatus: FetchStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

/** A short label for grouping bookmarks. */
export interface Tag {
  id: number;
  name: string;
}

/** Raw row shape as stored in the bookmarks table (snake_case columns). */
export interface BookmarkRow {
  id: number;
  url: string;
  normalized_url: string;
  title: string | null;
  note: string | null;
  preview_description: string | null;
  preview_image_url: string | null;
  fetch_status: FetchStatus;
  created_at: string;
  updated_at: string;
}

/** Map a DB row (+ its tags) into the API-facing Bookmark shape. */
export function rowToBookmark(row: BookmarkRow, tags: string[]): Bookmark {
  return {
    id: row.id,
    url: row.url,
    normalizedUrl: row.normalized_url,
    title: row.title,
    note: row.note,
    previewDescription: row.preview_description,
    previewImageUrl: row.preview_image_url,
    fetchStatus: row.fetch_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  };
}
