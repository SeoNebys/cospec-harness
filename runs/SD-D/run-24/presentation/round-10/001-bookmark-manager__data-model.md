# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and Functional Requirements. Storage is
SQLite; preserved copies are files on disk referenced by path. Field types are
logical (SQLite affinities in parentheses where useful).

## Entity: Bookmark

Represents a saved reference to a web page.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer PK | Stable identifier. |
| `url` | text | The address as saved (after normalizing scheme case only for display). Required, must be a well-formed web address (FR-002). |
| `normalized_url` | text | Light-normalized form for duplicate detection (research §8). **UNIQUE** (FR-006). |
| `title` | text | Display label; user-editable. Falls back to the address when metadata fails (FR-003/005). Required (non-empty). |
| `description` | text | User-editable; from `og:description`/meta on save; may be empty. |
| `icon_path` | text null | Local path to the stored site icon; null if unavailable. |
| `preview_image_path` | text null | Local path to stored preview image; null if unavailable. |
| `note_markdown` | text | Personal note, raw Markdown; may be empty (FR-007). |
| `read` | integer (bool) | Default **1 (read)**; read-later view lists `read = 0` (FR-017, Q2). |
| `archived` | integer (bool) | Default 0; archived items excluded from main list & ordinary search (FR-018/019). |
| `saved_at` | text (ISO datetime) | When first saved; preserved on merge as the earliest (FR-031). |
| `updated_at` | text (ISO datetime) | Last modification; used for "recently updated" sort (FR-013). |

**Relationships**: many-to-many with **Tag** (via `bookmark_tags`); one-to-one
with **PreservedCopy**.

**Validation & behavior**:
- Reject save when `url` is not a well-formed web address (FR-002).
- On create, if `normalized_url` already exists → do not insert; open existing
  (FR-006).
- `title` never empty: default to the address if no title is available (FR-003).
- State transitions: `read` ⇄ unread; `archived` ⇄ active; delete is permanent
  (distinct from archive, FR-018/024).

## Entity: Tag

A short, user-defined, reusable label.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer PK | |
| `name` | text | **UNIQUE** (case-insensitive). Reuse is encouraged via suggestions (FR-015a). |

**Relationships**: many-to-many with **Bookmark**.

### Join: bookmark_tags

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer FK → Bookmark.id | ON DELETE CASCADE |
| `tag_id` | integer FK → Tag.id | ON DELETE CASCADE |

Primary key `(bookmark_id, tag_id)`.

## Entity: SavedFilter

A named, reusable retrieval definition (FR-016).

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer PK | |
| `name` | text | **UNIQUE**; user-facing label. |
| `search_expression` | text | Rich-search string (may be empty). |
| `included_tag_ids` | text (JSON array) | Bookmarks must have **all** of these. |
| `excluded_tag_ids` | text (JSON array) | Bookmarks must have **none** of these. |

Applying: `parse(search_expression)` AND `has all included` AND `has none
excluded`.

## Entity: PreservedCopy

A stored capture of a bookmark's page (FR-025/026/028).

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `bookmark_id` | integer PK/FK → Bookmark.id | One per bookmark. ON DELETE CASCADE. |
| `type` | text enum | `mhtml` (full-page single file) or `pdf` (original PDF). |
| `file_path` | text null | Path under `data/captures/`; null when unavailable. |
| `status` | text enum | `available`, `unavailable` (capture failed / login-gated / over size limit), `pending`. |
| `byte_size` | integer null | Captured size; used against the 25 MB cap. |
| `wayback_url` | text null | Latest Internet Archive snapshot URL if found (FR-027). |
| `captured_at` | text (ISO datetime) null | When the local copy was made. |

## Entity: DisplayPreferences

Single-row personal presentation settings (FR-033).

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer PK | Always 1 (single user). |
| `default_sort` | text enum | `saved_desc`, `saved_asc`, `title_asc`, `title_desc`, `updated_desc`. |
| `page_size` | integer | Items shown per view (e.g., 25/50/100). |
| `text_size` | text enum | `small`, `medium`, `large`. |

## Search index (FTS5)

A `bookmarks_fts` virtual table mirrors `title`, `description`, `note_markdown`,
and `url` for case-insensitive full-text search (FR-010), kept in sync via
triggers on `bookmarks`. Tag membership is evaluated against `bookmark_tags`
(not FTS). Archived rows are filtered out of ordinary search at query time.

## Derived / computed

- `normalized_url`: computed on write (research §8).
- Tag suggestions: prefix/substring match over `Tag.name` (FR-015a).
- "All matching" bulk target: the id set produced by evaluating the active
  search/filter server-side, minus archived (unless archive view) (FR-021).

## Entity relationship summary

```text
Bookmark 1 ── 1 PreservedCopy
Bookmark * ── * Tag           (via bookmark_tags)
SavedFilter * ── * Tag        (by id references in included/excluded sets)
DisplayPreferences (singleton)
```
