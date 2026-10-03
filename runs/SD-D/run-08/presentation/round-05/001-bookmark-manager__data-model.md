# Phase 1 Data Model: Bookmark Manager

Storage: embedded SQLite. Text search is backed by an FTS5 virtual table kept in
sync with the `bookmarks` table via triggers. Binary artifacts live on disk and are
referenced by relative path. All timestamps are ISO-8601 UTC strings.

## Entities

### Bookmark

Represents a saved reference to a web page.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK | |
| `url` | text | Original address as entered/imported; used to open the page. |
| `url_key` | text, unique | Normalized canonical form (see URL normalization) for duplicate detection. |
| `title` | text | Auto-collected; user-editable (edit overrides). Fallback derived from URL. |
| `description` | text | Auto-collected; user-editable. |
| `note_md` | text | Personal note, raw Markdown (nullable). |
| `favicon_path` | text | Relative path to stored favicon (nullable). |
| `preview_path` | text | Relative path to stored preview image (nullable). |
| `snapshot_path` | text | Relative path to local snapshot (nullable until captured). For `html`, a single self-contained `.html` file (all assets inlined, usable offline); for `pdf`, the original PDF. |
| `snapshot_kind` | text | `html` (self-contained single file) \| `pdf` (original PDF) \| null. |
| `snapshot_status` | text | `pending` \| `ready` \| `failed`. A `failed` status MUST be visibly surfaced in the UI (FR-041). |
| `archive_org_url` | text | Reference to Internet Archive copy (nullable). |
| `archive_org_status` | text | `none` \| `pending` \| `ready` \| `failed`. A `failed` status MUST be visibly surfaced in the UI (FR-041). |
| `is_unread` | integer (bool) | `0` by default — NOT auto-set on create (FR-023). |
| `is_archived` | integer (bool) | `0` = active, `1` = archived (FR-029). |
| `created_at` | text | Creation time; on import, the preserved original `ADD_DATE` (FR-044). |
| `updated_at` | text | Last modification time. |

**Validation rules**
- `url` MUST be a well-formed web address (http/https) on create and on address edit
  (FR-002, FR-004); invalid → reject, save nothing.
- `url_key` MUST be unique. A create/address-edit that collides routes to the existing
  bookmark rather than inserting (FR-006, FR-007).
- On create, `is_unread = 0` (FR-023).
- `title` never empty when displayed: fallback derived from `url` if none collected
  (FR-005).

**State transitions**
- Read/unread: `is_unread` toggled only by explicit user action (FR-024).
- Archive: `is_archived` 0↔1 via archive/restore (FR-029, FR-031); archived rows are
  excluded from the normal list and search (FR-019).
- Delete: hard-deletes the row and cascades tag links and its snapshot files (FR-032).
- Snapshot: `pending → ready | failed`. `ready` HTML is a self-contained single file
  usable offline; PDF sources kept as the original PDF. A `failed` result is visibly
  surfaced and does not block the save (FR-038, FR-039, FR-041).
- Internet Archive: `none → pending → ready | failed`. A `failed` result is visibly
  surfaced and does not block the save (FR-040, FR-041).

### Tag

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK | |
| `name` | text, unique (case-insensitive) | Canonical tag label. |

- Suggestions match existing tag names as the user types (FR-021); selecting a
  suggestion reuses the existing tag rather than creating a near-duplicate.

### BookmarkTag (join)

Many-to-many between Bookmark and Tag.

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer FK → bookmarks.id | ON DELETE CASCADE |
| `tag_id` | integer FK → tags.id | ON DELETE CASCADE |

Primary key `(bookmark_id, tag_id)`.

### SavedView

A named, reusable combination of a search query with included/excluded tags.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK | |
| `name` | text | Display name (FR-033). |
| `query` | text | Search query string (may be empty). |
| `include_tags` | text (JSON array) | Tag names that must be present. |
| `exclude_tags` | text (JSON array) | Tag names that must be absent. |
| `sort` | text | Optional sort override for the view (nullable). |
| `created_at` | text | |

- Opening a view reproduces its filtered results (FR-034); views can be renamed and
  deleted (FR-034).

### Preferences

Single-row (single-user) settings.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer PK (always 1) | |
| `default_sort` | text | e.g. `created_desc`, `created_asc`, `title_asc`, `title_desc` (FR-042). |
| `items_per_page` | integer | Number of items shown (FR-042). |
| `font_size` | text | e.g. `small` \| `medium` \| `large` (FR-042). |

### Snapshot (conceptual)

Not a separate table; a Bookmark's snapshot is described by `snapshot_path`,
`snapshot_kind`, and `snapshot_status`. Files stored under `data/snapshots/<id>/`.
An HTML snapshot is a single self-contained `.html` file (all assets inlined) that
renders offline without contacting the original site; a PDF source is stored as the
original PDF. Failures (`snapshot_status = failed`) are surfaced in the UI, not
silent (FR-041).

## Search index (FTS5)

A virtual table `bookmarks_fts(title, description, note, url)` mirrors the text
columns of active bookmarks, maintained by insert/update/delete triggers. The search
executor combines FTS matches (text terms/phrases) with tag EXISTS conditions
(`#tag`, include/exclude) and boolean composition from the parsed query, always
filtering out archived rows (FR-019). See `contracts/search-grammar.md`.

## Relationships (summary)

- Bookmark *— many-to-many —* Tag (via BookmarkTag).
- SavedView references Tag names by value (include/exclude) and holds a query string.
- Preferences is a singleton.
