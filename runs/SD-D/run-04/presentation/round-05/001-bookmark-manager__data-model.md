# Phase 1 Data Model: Bookmark Manager

Storage: SQLite. Timestamps are ISO-8601 strings (UTC). Preserved artifacts are
files on disk referenced by relative path. Entities below map to the spec's Key
Entities and functional requirements.

## Entity: Bookmark

| Field             | Type     | Notes |
|-------------------|----------|-------|
| id                | integer  | Primary key |
| url               | text     | Original address as entered (http/https), display value |
| url_key           | text     | Normalized address for duplicate matching (FR-041), **unique** |
| title             | text     | Display title; user-edited value overrides auto-collected (FR-003) |
| description       | text     | Short description; editable |
| note_html         | text     | Sanitized formatted note (FR-009/010) |
| note_text         | text     | Plain-text extract of note for search indexing |
| icon_url          | text     | Site icon (favicon) reference; nullable |
| preview_image_url | text     | Preview image reference; nullable |
| is_read           | integer  | 0 = unread (default), 1 = read (FR-021) |
| is_archived       | integer  | 0 = active, 1 = archived (FR-023) |
| created_at        | text     | Creation timestamp; used by sort and export |
| updated_at        | text     | Last-updated timestamp; used by sort |

**Validation & rules**
- `url` MUST be a well-formed http/https address (FR-004); otherwise reject.
- `url_key` computed by the normalization rules (FR-041); its UNIQUE constraint
  enforces "no duplicates" (FR-007) across active *and* archived bookmarks.
- Saving/editing to an existing `url_key` opens the existing bookmark instead of
  inserting (FR-007/008); if that bookmark `is_archived`, offer restore (FR-008).
- New bookmarks default `is_read = 0` (unread) and `is_archived = 0`.
- `note_html` is sanitized on write; `note_text` derived from it.

**State transitions**
- read ⇄ unread (FR-021); archive → active via restore (FR-024, reversible);
  archiving preserves tags/note/read status for later restore.

## Entity: Tag

| Field        | Type    | Notes |
|--------------|---------|-------|
| id           | integer | Primary key |
| name         | text    | Display name |
| name_key     | text    | Lowercased/trimmed key, **unique** (case-insensitive uniqueness, FR-012) |

- Tag suggestions match `name_key` by prefix/substring, case-insensitively.
- Selecting a suggestion reuses the existing tag; a new tag is created only when
  no `name_key` matches (FR-012/013).

## Relationship: Bookmark ↔ Tag (many-to-many)

Join table `bookmark_tags(bookmark_id, tag_id)`, unique on the pair.
- Adding a tag already present is a no-op (used by import merge FR-036 and bulk
  tagging FR-026).

## Entity: SavedView

| Field         | Type    | Notes |
|---------------|---------|-------|
| id            | integer | Primary key |
| name          | text    | Display name (FR-029) |
| query         | text    | Search query string |
| included_tags | text    | JSON array of tag names to require |
| excluded_tags | text    | JSON array of tag names to exclude |
| created_at    | text    | Timestamp |

- Opening a view re-applies `query` + tag filters and shows current matches
  (FR-030). Rename/delete do not affect bookmarks (FR-029).

## Entity: PreservedCopy

| Field       | Type    | Notes |
|-------------|---------|-------|
| id          | integer | Primary key |
| bookmark_id | integer | FK → Bookmark |
| kind        | text    | `html` (self-contained), `pdf` (downloaded file), or `archive_org` |
| location    | text    | Relative file path (html/pdf) or Internet Archive URL |
| captured_at | text    | Capture timestamp |

- `html`: single self-contained HTML file with embedded assets (FR-031).
- `pdf`: the downloaded PDF file itself (FR-032).
- `archive_org`: the returned Internet Archive snapshot reference (FR-033).
- A bookmark may have multiple preserved copies (e.g., local HTML + archive.org).

## Entity: DisplayPreferences (single global row)

> All entities above (Bookmark, Tag, SavedView, PreservedCopy) and this
> DisplayPreferences row form **one global collection**. Nothing is keyed by
> session or cookie; the same data and settings are served on every browser
> visit and after every app restart (see research §9).


| Field          | Type    | Notes |
|----------------|---------|-------|
| id             | integer | Fixed single global row (not session-scoped) |
| default_sort   | text    | one of: `added_desc`, `added_asc`, `title`, `updated_desc`, `read_status` (FR-028/039) |
| items_per_page | integer | Page size for the list (FR-040) |
| text_size      | text    | one of: `small`, `medium`, `large` (FR-039) |

## Derived/behavioral notes

- **Search index**: title, description, note_text, url, and tag names feed
  case-insensitive matching (FR-017). SQLite FTS5 may back word matching; the
  boolean/phrase/#tag composition is handled by the parser (see research §5).
- **Archive exclusion**: default list/search/unread queries filter
  `is_archived = 0`; the archive view filters `is_archived = 1` (FR-020/023).
- **Unread view**: `is_read = 0 AND is_archived = 0` (FR-022).
- **Bulk "select all matching"**: resolves the **complete current view**, not
  just the search words or a single tag. The resolver re-evaluates the full
  filter — `q`, all included and excluded tags, quick tag-filters, the active
  view (`active`/`unread`/`archive`), and any open saved view — using the same
  query logic as the list, ignoring pagination so it covers items on every page
  (FR-025). The same resolver backs the pre-deletion affected-count preview
  (FR-027).
