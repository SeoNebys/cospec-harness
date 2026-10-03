/** Reading lifecycle attached to a saved bookmark. */
export const READING_STATES = ["untracked", "to_read", "read"] as const;
export type ReadingState = (typeof READING_STATES)[number];

/** Supported deterministic orderings for bookmark lists. */
export const SORT_ORDERS = ["newest", "oldest", "title"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** API-level bookmark collection selection. */
export const BOOKMARK_LIST_VIEWS = ["all", "read-later"] as const;
export type BookmarkListView = (typeof BOOKMARK_LIST_VIEWS)[number];

export const METADATA_OUTCOMES = [
  "complete",
  "partial",
  "unavailable",
] as const;
export type MetadataOutcome = (typeof METADATA_OUTCOMES)[number];

export interface Tag {
  name: string;
  normalizedName: string;
  bookmarkCount: number;
}

export interface TagList {
  items: Tag[];
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  readingState: ReadingState;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body accepted by bookmark create and replace operations.
 * Optional properties receive their documented defaults at validation time.
 */
export interface BookmarkInput {
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  readingState?: ReadingState;
  allowDuplicate?: boolean;
}

export interface BookmarkList {
  items: Bookmark[];
  total: number;
}

/** Raw query parameters accepted by the list endpoint. */
export interface BookmarkListQuery {
  view?: BookmarkListView;
  query?: string;
  tag?: string[];
  sort?: SortOrder;
}

/** List parameters after request-schema defaults have been applied. */
export interface ResolvedBookmarkListQuery {
  view: BookmarkListView;
  query: string;
  tag: string[];
  sort: SortOrder;
}

export interface ReadingStateUpdate {
  readingState: ReadingState;
}

export interface PageMetadataRequest {
  url: string;
}

export interface MetadataPreview {
  requestedUrl: string;
  finalUrl?: string | null;
  outcome: MetadataOutcome;
  title: string | null;
  description: string | null;
  message?: string;
}

export type FieldErrors = Record<string, string>;

export interface ErrorDetail {
  code: string;
  message: string;
  fieldErrors?: FieldErrors;
}

export interface ErrorResponse {
  error: ErrorDetail;
}

export interface DuplicateErrorResponse {
  error: {
    code: "DUPLICATE_URL";
    message: string;
  };
  existingBookmark: Bookmark;
}

export interface HealthResponse {
  status: "ok";
}
