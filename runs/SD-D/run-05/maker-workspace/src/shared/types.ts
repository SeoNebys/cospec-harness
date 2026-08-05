// Shared data shapes used by both the background process and the UI.
// These mirror the entities in specs/001-manage-bookmarks/data-model.md.

export type SortOrder = 'newest' | 'oldest' | 'title'

export type SavedCopyKind = 'reader' | 'pdf'
export type SavedCopyStatus = 'pending' | 'captured' | 'unavailable'

export interface SavedCopy {
  id: string
  bookmarkId: string
  kind: SavedCopyKind
  filePath: string | null
  status: SavedCopyStatus
  capturedAt: string | null
}

export interface Bookmark {
  id: string
  url: string
  title: string
  description: string
  faviconPath: string | null
  noteHtml: string | null
  noteText: string | null
  isRead: boolean
  isArchived: boolean
  savedCopyId: string | null
  createdAt: string
  updatedAt: string
}

// A bookmark plus the derived fields the list view needs (tags, copy status).
export interface BookmarkSummary extends Bookmark {
  tags: string[]
  savedCopyStatus: SavedCopyStatus | null
}

export interface Tag {
  id: string
  name: string
}

export interface SavedSearch {
  id: string
  name: string
  keywords: string | null
  tagFilter: string | null
  unreadOnly: boolean
  includeArchived: boolean
  createdAt: string
}

// Result of a save attempt (contracts/bookmark-operations.md → saveBookmark).
export type SaveResult =
  | { ok: false; error: 'invalid-url'; message: string }
  | { ok: true; duplicate: boolean; bookmark: Bookmark }

// Result of editing an existing bookmark (contracts/bookmark-operations.md →
// updateBookmark). Editing the address to one already saved is rejected as a
// duplicate, upholding one-bookmark-per-address (FR-017).
export type UpdateResult =
  | { ok: true; bookmark: Bookmark }
  | { ok: false; error: 'invalid-url' | 'duplicate' | 'not-found'; message: string }

// The fields the detail/edit view can change (FR-010, FR-011, FR-013).
export interface BookmarkEdit {
  title?: string
  description?: string
  url?: string
  noteHtml?: string
}

// A search/filter request (contracts/search-operations.md). Archived bookmarks
// are excluded unless includeArchived is explicitly true (FR-023a).
export interface SearchQuery {
  text?: string
  tags?: string[]
  tagMode?: 'and' | 'or'
  unreadOnly?: boolean
  includeArchived?: boolean
  sort?: SortOrder
}

// Criteria supplied when saving a search (FR-023).
export interface SavedSearchInput {
  name: string
  text?: string
  tags?: string[]
  unreadOnly?: boolean
  includeArchived?: boolean
}

// Which bookmarks a batch action targets: an explicit list, or everything a
// search/filter currently matches (FR-025).
export type BatchSelection = { ids: string[] } | { query: SearchQuery }

// A single action applied to many bookmarks at once (FR-024/026).
export type BatchAction =
  | { type: 'addTag'; tagName: string }
  | { type: 'removeTag'; tagName: string }
  | { type: 'setRead'; value: boolean }
  | { type: 'archive'; value: boolean }
  | { type: 'delete'; confirmed: boolean }

export interface BatchResult {
  ok: boolean
  affected: number
}

// Outcome of importing a browser bookmarks file (FR-029): how many were added,
// skipped as already-present, or unreadable.
export interface ImportSummary {
  added: number
  skipped: number
  failed: number
}

// Live progress emitted while a large import runs (FR-025, FR-029).
export interface ImportProgress extends ImportSummary {
  processed: number
  total: number
}

// Result the UI receives from the import/export operations (which first show a
// file picker in the desktop app).
export type ImportResult = ({ canceled: false } & ImportSummary) | { canceled: true }
export type ExportResult = { canceled: false; count: number } | { canceled: true }

// Page metadata fetched for a bookmark.
export interface PageMetadata {
  title: string | null
  description: string | null
  faviconUrl: string | null
}

// What the UI receives when it opens a bookmark's saved copy (US3). Reader
// copies come back as ready-to-render sanitized HTML; PDFs come back as a local
// file path the app can display or open.
export type SavedCopyView =
  | { status: 'pending' | 'unavailable' }
  | { status: 'captured'; kind: 'reader'; html: string }
  | { status: 'captured'; kind: 'pdf'; filePath: string }
