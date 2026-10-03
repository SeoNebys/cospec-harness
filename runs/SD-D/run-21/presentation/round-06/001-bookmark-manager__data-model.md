# Data Model: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-25 | **Phase**: 1

Derived from the spec's Key Entities and Functional Requirements. Storage is
SQLite; binary captures live on disk referenced by path. Field types are logical
(implementation maps them to SQLite affinities).

## Entities

### Bookmark

The saved reference to a web page.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | Unique identifier. |
| `url` | text, required, unique | The web address. Unique across the collection (FR-015). Validated well-formed (FR-001). |
| `title` | text, required | Fetched or user-set; falls back to `url` when metadata unavailable (FR-004). |
| `description` | text, nullable | Fetched or user-set (FR-002/003). |
| `note_html` | text, nullable | Sanitized rich-text note HTML (FR-026). |
| `note_text` | text, nullable | Plain-text projection of the note, for search (FR-008). |
| `icon_path` | text, nullable | Stored/derived site icon reference. |
| `preview_image_url` | text, nullable | Preview (OG) image reference (FR-002). |
| `is_read` | boolean, required | Read/unread status; default false (unread = "read later"). **Independent** of `is_archived` (FR-016). |
| `is_archived` | boolean, required | Archived (hidden from normal + read-later views); default false. **Independent** of `is_read` (FR-017). |
| `created_at` | datetime, required | Date saved (FR-005). |
| `updated_at` | datetime, required | Date last updated (FR-005). |

**Validation & rules**:
- `url` must be a valid http/https address; empty/malformed rejected (FR-001).
- Saving an existing `url` resolves to opening that bookmark for edit, never a
  duplicate (FR-015).
- `is_read` and `is_archived` are two independent boolean axes; changing one
  MUST NOT change the other (FR-016/017).
- **Views are derived** from these flags, not stored as a state:
  - Normal list = `is_archived = false`.
  - Read-later view = `is_archived = false AND is_read = false`.
  - Archive view = `is_archived = true` (any `is_read`).
- Archiving sets `is_archived = true`; restoring sets `is_archived = false` and
  changes nothing else — an unread bookmark restored is still unread and
  reappears in the read-later view (FR-017).
- Permanent delete removes the row entirely and is distinct from archiving
  (FR-018).

### Tag

A short text label.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | |
| `name` | text, required, unique | Case-insensitive unique; used for suggestions (FR-012). |

### BookmarkTag (join)

Many-to-many between Bookmark and Tag.

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer, FK → Bookmark | Cascade delete with bookmark. |
| `tag_id` | integer, FK → Tag | |

Primary key `(bookmark_id, tag_id)`.

### SavedView

A named, reusable filter (FR-014).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | |
| `name` | text, required | Display name. |
| `query` | text, nullable | Search string using the query language. |
| `included_tags` | text (list) | Tags that must be present. |
| `excluded_tags` | text (list) | Tags that must be absent. |
| `created_at` | datetime | |

Resolved live against the current collection; never stores a fixed bookmark set.

### PageCapture

A stored local capture linked to a bookmark (FR-023).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | |
| `bookmark_id` | integer, FK → Bookmark | Cascade delete. |
| `kind` | text enum | `html` (self-contained) or `pdf` (preserved). |
| `file_path` | text | Relative path under `data/captures/`. |
| `captured_at` | datetime | |
| `status` | text enum | `ready` or `failed` (best-effort; FR-025). |

### ArchiveSnapshot

A reference to an Internet Archive capture (FR-024).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | |
| `bookmark_id` | integer, FK → Bookmark | Cascade delete. |
| `snapshot_url` | text, nullable | Wayback URL when available. |
| `requested_at` | datetime | |
| `status` | text enum | `pending`, `ready`, or `failed` (FR-025). |

### Preferences

The single user's display settings (FR-028). One row (single-user app).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | Always 1. |
| `default_sort` | text enum | e.g. `newest`, `oldest`, `title_az`, `title_za`, `recently_updated` (FR-007). |
| `density` | text enum | `comfortable` / `compact` — information shown per item (FR-027). |
| `text_size` | text enum | e.g. `small` / `medium` / `large`. |

## Relationships (summary)

- Bookmark 1—* PageCapture, Bookmark 1—* ArchiveSnapshot (cascade on delete).
- Bookmark *—* Tag via BookmarkTag.
- SavedView references tags/queries by value, not by foreign key to bookmarks.
- Preferences is a singleton.

## Indexes (performance — SC-002/SC-003)

- `bookmark.url` unique index (duplicate detection, FR-015).
- `bookmark.is_archived`, `bookmark.is_read` to support the normal, read-later,
  and archive views.
- `bookmark.created_at`, `bookmark.updated_at`, `bookmark.title` to support the
  sort options.
- `tag.name` unique (case-insensitive) for suggestions and filtering.
- Optional SQLite FTS index over `title/url/description/note_text/tags` to
  shortlist candidates before boolean evaluation.

## Two independent axes (not a single state)

Read/unread and archived are orthogonal booleans, giving four combinations. The
three views are derived filters over them.

```text
                         is_read = false (unread / "read later")   is_read = true (read)
 is_archived = false     Normal list  +  Read-later view           Normal list
 is_archived = true      Archive view                              Archive view

 toggle read/unread : flips is_read only   (is_archived unchanged)
 archive            : is_archived = true   (is_read unchanged)
 restore            : is_archived = false  (is_read unchanged — unread stays unread)
 permanent delete   : row removed          (distinct from archiving)
```

Example (the client's case): an unread bookmark (`is_read=false`) archived
(`is_archived=true`) sits only in the archive view. Restoring it sets
`is_archived=false` and leaves `is_read=false`, so it returns to both the normal
list and the read-later view — never silently marked read.
