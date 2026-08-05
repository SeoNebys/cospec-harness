export type FetchStatus = "pending" | "success" | "failed";

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

export interface Tag {
  id: number;
  name: string;
}

/** The display label for a bookmark: title if present, else the address (FR-003). */
export function displayLabel(b: Bookmark): string {
  return b.title && b.title.trim() ? b.title : b.url;
}
