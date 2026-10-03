# Phase 1 Data Model: Bookmark Manager

Storage: SQLite. Timestamps are ISO-8601 UTC strings. Preserved page copies are
stored as files on disk; the DB holds their reference path only.

## Entity: Bookmark

Represents a saved link (spec Key Entities → Bookmark).

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | autoincrement |
| url | text, required, unique | normalized; uniqueness enforces edit-on-duplicate (FR-008) |
| title | text | fetched or user-edited (FR-003/FR-004); falls back to URL when empty (FR-005) |
| description | text | fetched or user-edited |
| note | text | raw Markdown; rendered+sanitized for display (FR-006) |
| icon_url | text | site favicon reference |
| preview_image_url | text | preview/OG image reference |
| is_read | integer(0/1) | read/unread state; **default 1 = read** — new bookmarks start read and enter the unread view only when the user marks them for later (FR-015) |
| is_archived | integer(0/1) | archived state; default 0 (FR-016) |
| page_copy_path | text | file path of local single-file copy, null if none (FR-021); the on-disk file is removed when the bookmark is permanently deleted, but retained when it is merely archived |
| page_copy_kind | text | `html` or `pdf`, null if none |
| archive_org_url | text | Internet Archive snapshot link, null if none (FR-022) |
| created_at | text | creation timestamp (FR-018, sorting) |
| updated_at | text | last-updated timestamp (FR-018, sorting) |

**Validation**
- `url` must be well-formed or the save is rejected (FR-002).
- Saving an existing `url` does not insert; it returns the existing row for
  editing (FR-008).
- `is_read`, `is_archived` ∈ {0,1}.

**State transitions**
- read ↔ unread (mark read / mark unread, FR-015). New bookmarks begin `read`
  (is_read = 1); they only appear in the unread view after being marked for later.
- active ↔ archived (archive / restore; reversible, FR-016). Archived rows are
  excluded from the normal list and default search. Archiving **retains** any
  local page copy.
- **Permanent delete** removes the row and cascades to `bookmark_tags`, and MUST
  also delete the associated local page-copy file (if any) from
  `data/pagecopies/`. Archiving must NOT delete the page-copy file.

## Entity: Tag

Short label grouping bookmarks (spec → Tag).

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| name | text, required, unique (case-insensitive) | uniqueness enforced even on typed entry (FR-014a) |

## Relationship: bookmark_tags (many-to-many)

| Field | Type | Notes |
|-------|------|-------|
| bookmark_id | integer FK → Bookmark(id) | on delete cascade |
| tag_id | integer FK → Tag(id) | on delete cascade |

Primary key = (bookmark_id, tag_id). Backs tagging, `#tag` search, tag
suggestions, and filter include/exclude.

## Entity: SavedFilter

Named reusable query (spec → Saved Filter, FR-019).

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| name | text, required, unique | |
| terms | text | free-text search terms |
| include_tags | text | JSON array of tag names to require |
| exclude_tags | text | JSON array of tag names to exclude |
| created_at | text | |

## Entity: Preferences

Single-row user display settings (spec → Preferences, FR-024).

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | always 1 (single-user) |
| default_sort | text | one of `newest`, `oldest`, `title`, `updated`; default `newest` |
| page_size | integer | items shown per view; default e.g. 25 |
| text_size | text | one of `small`, `medium`, `large`; default `medium` |

## Derived / non-persistent concepts

- **Page Copy** (spec entity) is represented by `page_copy_path` +
  `page_copy_kind` on Bookmark plus the on-disk file under `data/pagecopies/`.
- **Search query AST** is parsed per request from the query string; not stored.

## Indexes

- Unique index on `Bookmark.url`.
- Unique (case-insensitive) index on `Tag.name`.
- Index on `Bookmark(is_archived, is_read)` and on `created_at`/`updated_at` to
  keep list/sort/filter fast at the target scale.
