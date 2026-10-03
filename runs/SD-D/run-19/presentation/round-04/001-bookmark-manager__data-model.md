# Phase 1 Data Model: Bookmark Manager

Storage: SQLite (`data/bookmarks.db`). Preserved page/PDF blobs live on disk under
`data/preserved/` and are referenced by path. All timestamps are ISO-8601 UTC
strings. Booleans stored as 0/1.

## Entity: Bookmark

Represents one saved link. (Spec: Bookmark entity; FR-001–012, 018, 026–029, 032–035.)

| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | autoincrement |
| url | TEXT NOT NULL | original address as entered |
| url_key | TEXT NOT NULL UNIQUE | normalised canonical URL for duplicate detection (R8) |
| title | TEXT NOT NULL | auto-collected, user-adjustable; derived fallback if none (FR-003a/004) |
| description | TEXT | auto-collected, user-adjustable |
| note_md | TEXT | Markdown source, stored verbatim (FR-008) |
| favicon_url | TEXT | resolved favicon address |
| preview_image_url | TEXT | resolved preview/OG image address |
| tags | via bookmark_tags | see relationship |
| is_read | INTEGER NOT NULL default 0 | read/unread state (FR-018) |
| is_archived | INTEGER NOT NULL default 0 | archived state (FR-026–029) |
| metadata_unavailable | INTEGER NOT NULL default 0 | set when auto-fetch failed (FR-004) |
| preserved_html_path | TEXT | path to self-contained HTML copy (FR-032) |
| preserved_pdf_path | TEXT | path to original PDF when link is a PDF (FR-033) |
| archive_org_url | TEXT | Internet Archive snapshot link (FR-034) |
| date_added | TEXT NOT NULL | creation timestamp; preserved on import (FR-036) |
| date_modified | TEXT NOT NULL | last edit timestamp |

**Validation**
- `url` MUST be a well-formed http/https URL (FR-002); else reject, save nothing.
- `url_key` UNIQUE enforces no duplicates; a save colliding on `url_key` returns
  the existing bookmark for editing rather than inserting (FR-005), and a
  conflicting edit is rejected with a warning (FR-007).
- `title` non-empty (derived if the page/user supplies none) (FR-003a/004).

**State transitions**
- read/unread: `is_read` 0↔1 (FR-018).
- archive/restore: `is_archived` 0→1 (archive, FR-026) and 1→0 (restore, FR-027).
- permanent delete: row removed and any `preserved_html_path`/`preserved_pdf_path`
  files deleted (FR-028) — distinct from archive, irreversible.

**Scope predicate (drives lists, search, and select-all-matching)**
- Normal / unread / search views: `is_archived = 0` (unread view additionally
  `is_read = 0`) (FR-029).
- Archive view: `is_archived = 1`.

## Entity: Tag

A reusable label. (Spec: Tag entity; FR-020–022.)

| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | case-insensitive unique (COLLATE NOCASE) |

- The distinct set of `name`s in use powers tag suggestions (FR-021) and the
  include/exclude tag filters (FR-022).
- A tag with no remaining bookmarks may be pruned (housekeeping; not required).

## Relationship: bookmark_tags (many-to-many)

| Field | Type | Notes |
|-------|------|-------|
| bookmark_id | INTEGER FK→bookmark.id | ON DELETE CASCADE |
| tag_id | INTEGER FK→tag.id | ON DELETE CASCADE |

- PRIMARY KEY (bookmark_id, tag_id). A bookmark may carry many tags; a tag may
  apply to many bookmarks. Bulk add/remove tag operates on this table (FR-024).

## Entity: SavedSearch

A named, revisitable query. (Spec: Saved Search entity; FR-030–031.)

| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | display name |
| query_text | TEXT | the search expression (may be empty) |
| include_tags | TEXT | JSON array of tag names to require |
| exclude_tags | TEXT | JSON array of tag names to exclude |
| date_added | TEXT NOT NULL | |

- Revisiting re-applies `query_text` + include/exclude tags to reproduce results
  (FR-030). Deleting a saved search does not affect any bookmark (FR-031).

## Entity: Preferences (single row)

Persisted display settings. (Spec: Preferences entity; FR-040.)

| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK CHECK(id=1) | singleton row |
| default_sort | TEXT NOT NULL | one of `date_added_desc`, `date_added_asc`, `title_asc`, `title_desc` |
| items_per_page | INTEGER NOT NULL | page size for lists |
| text_size | TEXT NOT NULL | one of `small`, `medium`, `large` |

## Derived / non-persistent concepts

- **Preserved Copy** (spec entity): not a separate table — represented by the
  `preserved_html_path`, `preserved_pdf_path`, and `archive_org_url` fields on
  Bookmark (R5).
- **Search result / current view**: computed at query time from the scope
  predicate + compiled search AST + tag filters + sort + paging; the same
  computation (without paging) backs "select all matching" (FR-023).

## Indexes

- UNIQUE(bookmark.url_key) — duplicate detection.
- UNIQUE(tag.name COLLATE NOCASE) — tag identity & suggestions.
- INDEX(bookmark.is_archived, is_read) — view scoping.
- INDEX(bookmark.date_added), INDEX(bookmark.title COLLATE NOCASE) — sorting.
- bookmark_tags PK covers membership lookups.
