// Shared domain types used by both the backend (src/server) and the SPA (src/web).
// Traces to data-model.md and contracts/filter-model.md.

export type EnrichStatus = 'pending' | 'done' | 'failed';

export type SortOrder = 'newest' | 'oldest' | 'title';

export type View = 'all' | 'readLater' | 'archived';

/** A saved reference to a web page (data-model.md → Bookmark). */
export interface Bookmark {
  id: number;
  url: string;
  title: string;
  description: string;
  notes: string;
  notesHtml: string; // notes rendered to sanitized HTML (FR-018)
  iconUrl: string | null;
  imageUrl: string | null;
  tags: string[];
  readLater: boolean;
  archived: boolean;
  enrichStatus: EnrichStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Payload for creating a bookmark (contracts/rest-api.md → POST /api/bookmarks). */
export interface CreateBookmarkInput {
  url: string;
  title?: string;
  description?: string;
  notes?: string;
  tags?: string[];
}

/** Partial update (contracts/rest-api.md → PATCH /api/bookmarks/:id). */
export interface UpdateBookmarkInput {
  url?: string;
  title?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  readLater?: boolean;
  archived?: boolean;
}

/** A reusable filter definition (contracts/filter-model.md). */
export interface TagFilter {
  text?: string;
  tagsAny?: string[];
  tagsAll?: string[];
  tagsNot?: string[];
  view?: View;
  sort?: SortOrder;
}

/** A named, reusable filter (data-model.md → SavedSearch). */
export interface SavedSearch {
  id: number;
  name: string;
  queryText: string;
  filter: TagFilter;
  createdAt: string;
}

/** Portable backup document (contracts/rest-api.md → GET /api/export). */
export interface ExportFile {
  format: 'bookmark-manager-export';
  version: 1;
  exportedAt: string;
  bookmarks: Array<
    Pick<
      Bookmark,
      | 'url'
      | 'title'
      | 'description'
      | 'notes'
      | 'tags'
      | 'readLater'
      | 'archived'
      | 'createdAt'
      | 'updatedAt'
    >
  >;
  savedSearches: Array<Pick<SavedSearch, 'name' | 'queryText' | 'filter'>>;
}
