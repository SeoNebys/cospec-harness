# Phase 1 Data Model: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-24
**Store**: SQLite (`better-sqlite3`). Timestamps are ISO-8601 UTC strings. Preserved
files live on disk under `data/preserved/`; the DB stores their relative paths.

## Entities

### Bookmark

The saved reference to a web page.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK | Auto-increment |
| `address` | text, required, unique | Well-formed http/https URL; uniqueness drives dedup (FR-016) |
| `title` | text | Captured or user-edited; falls back to address (FR-003) |
| `description` | text | Captured or user-edited |
| `note` | text | Raw Markdown (FR-038) |
| `icon_url` | text | Favicon URL captured from page |
| `preview_image_url` | text | og:image/twitter:image captured from page |
| `is_unread` | integer (0/1) | Read-later state; default 1 = unread (FR-020) |
| `is_archived` | integer (0/1) | Archived state; default 0 (FR-021) |
| `date_added` | text | Creation timestamp; may be set from import file (FR-032) |
| `date_updated` | text | Last-updated timestamp (FR-039) |
| `preserved_copy_path` | text, nullable | Relative path to single self-contained HTML or PDF (FR-034/035) |
| `preserved_copy_kind` | text, nullable | `html` or `pdf` |
| `preserved_at` | text, nullable | When the offline copy was stored |
| `archive_org_url` | text, nullable | Internet Archive snapshot link (FR-036) |
| `archive_org_at` | text, nullable | When the snapshot link was stored |

**Validation rules**:

- `address` MUST be a well-formed http/https URL (FR-002); empty/malformed rejected.
- `address` is unique; saving an existing address resolves to the existing row for
  editing (FR-016) rather than inserting.
- `is_unread`, `is_archived` are strictly 0 or 1.

**State transitions**:

- Read-later: `is_unread` 1 ⇄ 0 (mark read / mark unread) — FR-018.
- Archive: `is_archived` 0 → 1 (archive, hides from normal views) → 0 (restore) —
  FR-021/022. Independent of deletion (FR-023).
- Delete: hard removal of the row (and its tag links + preserved files) after
  confirmation (FR-017).

### Tag

A short user-defined label.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK | Auto-increment |
| `name` | text, required, unique | Case-insensitive uniqueness; normalized on input |

**Relationships**: many-to-many with Bookmark via `bookmark_tags`.

### bookmark_tags (join)

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer FK → Bookmark.id | ON DELETE CASCADE |
| `tag_id` | integer FK → Tag.id | ON DELETE CASCADE |

Primary key (`bookmark_id`, `tag_id`). Powers tag filtering (FR-014), `#tag` search
(FR-009), suggestions (FR-013), and bulk tag add/remove (FR-026). A tag with no
remaining links is eligible to disappear from suggestions/filters (US3 scenario 4).

### SavedSearch

A named, reusable query with included/excluded tags.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK | Auto-increment |
| `name` | text, required | Display name |
| `query_text` | text | The text/boolean query string |
| `included_tags` | text | Serialized list of tag names that must be present |
| `excluded_tags` | text | Serialized list of tag names that must be absent |
| `date_created` | text | Creation timestamp |

Supports create/run/edit/delete (FR-029/030).

### Preference (single-row settings)

Display preferences persisted across sessions (FR-028).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK | Always 1 (single-user, single row) |
| `default_sort` | text | One of: `newest`, `oldest`, `title`, `updated` (FR-027) |
| `items_shown` | integer | Number of items shown per page/list |
| `text_size` | text | e.g. `small`, `medium`, `large` |

## Derived / computed concerns

- **Search AST**: not persisted. Built at request time by the parser from `query_text`
  (Decision 4) and evaluated over candidate rows. Normal search excludes
  `is_archived = 1` rows (US2 scenario 11 / US6).
- **Preserved files**: stored on disk; the DB holds `preserved_copy_path` +
  `preserved_copy_kind`. Deleting a bookmark removes its preserved file(s).

## Indexing

- Unique index on `Bookmark.address`.
- Unique (case-insensitive) index on `Tag.name`.
- Index on `bookmark_tags(tag_id)` and `(bookmark_id)` for filter/suggestion queries.
- Indexes on `Bookmark(is_archived, is_unread, date_added)` to keep list/filter/sort
  responsive at 500+ rows (SC-003).
