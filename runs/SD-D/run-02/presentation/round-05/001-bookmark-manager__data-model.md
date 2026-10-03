# Data Model: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16
Derived from spec Key Entities + FR-001–FR-039. Storage: SQLite via
`better-sqlite3`; binary files (snapshots, cached images) on disk under `data/`.

## Entities

### Bookmark

The core saved reference. (Spec: Bookmark entity; FR-001–014, 032–034, 039.)

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `url` | TEXT NOT NULL | Original, normalized (R11). Duplicate detection key. |
| `url_key` | TEXT NOT NULL UNIQUE | Normalized form used for dedupe (FR-006). |
| `title` | TEXT | Auto-fetched or user-edited (FR-003/004). Fallback = url. |
| `description` | TEXT | Auto-fetched or user-edited. |
| `favicon_path` | TEXT | Local cached file; null → use `favicon_url`/placeholder. |
| `favicon_url` | TEXT | Remote fallback. |
| `preview_path` | TEXT | Local cached preview image; null → `preview_url`/none. |
| `preview_url` | TEXT | Remote fallback. |
| `note_md` | TEXT | Markdown source (FR-007). Rendered on view. |
| `read_state` | TEXT NOT NULL | `unread` \| `read` (FR-009). Default `unread`. |
| `archived` | INTEGER NOT NULL | 0/1 (FR-010). Default 0. |
| `metadata_status` | TEXT NOT NULL | `pending` \| `complete` \| `failed` (FR-005, async). |
| `internet_archive_url` | TEXT | Set by archive.org save (FR-033). |
| `date_added` | TEXT NOT NULL | ISO 8601. Preserved on import (FR-012/035). |
| `date_updated` | TEXT NOT NULL | ISO 8601, touched on any edit. |

Indexes: `url_key` (unique), `archived`, `read_state`, `date_added`, `title`.
A snapshot, if any, is linked from the `snapshot` table (0..1 per bookmark).

### Tag

Shared-identity label. (Spec: Tag entity; FR-008, FR-008a, FR-015, FR-019.)

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Display name (first-seen casing). |
| `name_key` | TEXT NOT NULL UNIQUE | Normalized (trim + case-fold) identity. **One row per name_key** — enforces FR-008a. |

### BookmarkTag (join)

Many-to-many between bookmarks and tags.

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | INTEGER FK → bookmark(id) ON DELETE CASCADE | |
| `tag_id` | INTEGER FK → tag(id) ON DELETE CASCADE | |

Primary key `(bookmark_id, tag_id)` — a bookmark cannot carry the same tag twice.
Assigning a tag resolves/creates the tag by `name_key` first, then inserts the
join row, so reuse always points at one identity (FR-008a).

### SavedSearch

Named reusable query. (Spec: Saved Search; FR-029–031.)

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL UNIQUE | |
| `query_text` | TEXT | Raw search expression (may be empty). |
| `include_tags` | TEXT (JSON array of name_key) | Tags that must all be present (FR-030). |
| `exclude_tags` | TEXT (JSON array of name_key) | Tags that must be absent (FR-030). |
| `view_scope` | TEXT NOT NULL | `normal` \| `unread` \| `archived`. |
| `sort` | TEXT NOT NULL | One of the supported sort keys. |
| `date_created` | TEXT NOT NULL | |

### Snapshot

Stored local copy. (Spec: Snapshot; FR-032.)

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `bookmark_id` | INTEGER FK → bookmark(id) ON DELETE CASCADE UNIQUE | 0..1 per bookmark. |
| `kind` | TEXT NOT NULL | `html` (self-contained) \| `pdf` (original). |
| `file_path` | TEXT NOT NULL | Path under `data/snapshots/`. |
| `byte_size` | INTEGER | For storage reporting / low-storage handling. |
| `date_captured` | TEXT NOT NULL | |

### Preferences (singleton)

Display settings. (Spec: Display Preferences; FR-038.)

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK CHECK(id=1) | Single row. |
| `default_sort` | TEXT NOT NULL | Default `date_added_desc`. |
| `items_per_page` | INTEGER NOT NULL | Default 25. |
| `font_size` | TEXT NOT NULL | `small` \| `medium` \| `large`. Default `medium`. |

## Relationships

- Bookmark 1—* BookmarkTag *—1 Tag (many-to-many, shared tag identity).
- Bookmark 1—0..1 Snapshot.
- SavedSearch references tags by `name_key` (loose reference; resolved at run
  time so a renamed/deleted tag degrades gracefully).
- Preferences is a global singleton.

## Validation rules (mapped to FRs)

- **URL**: required; must be http/https after normalization; missing scheme →
  `https://` added; other schemes rejected with a message (FR-002/003, R11).
- **Duplicate**: on create, if `url_key` exists, return the existing bookmark
  (no insert) so the UI opens it for editing (FR-006). Same rule during import
  (FR-035).
- **Editable fields**: url (re-normalized + re-dedupe-checked), title,
  description, tags, note may change any time (FR-004).
- **Tags**: resolved by `name_key`; never duplicated (FR-008a); empty/whitespace
  tag names rejected.
- **Read state**: only `unread`/`read` (FR-009).
- **Note**: stored as Markdown text; rendered + sanitized on display (FR-007).
- **Preferences**: `items_per_page` positive; `font_size` in enum;
  `default_sort` in the supported set (FR-038).

## State transitions

**Bookmark.metadata_status**: `pending` → `complete` (fetch succeeded, fields
filled) or `pending` → `failed` (unreachable/timeout; fallbacks applied,
bookmark still usable). A later manual edit does not change status.

**Bookmark.archived**: `0 ⇄ 1` (archive/unarchive, reversible, no other data
changes — FR-010). Archived bookmarks are excluded from the normal list and
normal search (FR-013/024) and appear only in the archived view (FR-016).

**Bookmark.read_state**: `unread ⇄ read` (FR-009); unread view reflects current
state.

**Bookmark lifecycle**: created → (edited)* → archived/unarchived* →
**permanently deleted** (hard delete, cascades tags/snapshot; irreversible and
distinct from archive — FR-011).

## Sort keys (FR-025 / FR-038)

`date_added_desc` (default, most-recently-saved first), `date_added_asc`,
`title_asc`, `title_desc`, `read_state` (unread first). Applied to both browsing
and search results, and stored as the display-preference default.
