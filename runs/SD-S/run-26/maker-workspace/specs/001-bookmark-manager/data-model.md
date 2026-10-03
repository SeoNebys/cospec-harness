# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and Functional Requirements. Storage is
SQLite; large assets live on disk with paths recorded here.

## Entity: Bookmark

Represents one saved, content-preserving reference to a web page or PDF.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer, PK | Auto-assigned. |
| `address` | text, required | Original submitted URL. Must be a well-formed web address (FR-002). |
| `normalized_url` | text, indexed | Canonical form for duplicate detection (FR-018). Unique across all bookmarks (active + archived). |
| `title` | text | Auto-fetched or user-edited (FR-003/FR-004). Falls back to a value derived from the address (FR-005). |
| `description` | text, nullable | Auto-fetched or user-edited. May be empty when unavailable. |
| `favicon_path` | text, nullable | Local path under `data/favicons/`; null if none captured. |
| `preview_image_path` | text, nullable | List thumbnail: `og:image` download or captured screenshot, under `data/thumbnails/`; null if none. |
| `notes` | text, nullable | Free-form user notes (FR-015). Searchable. |
| `status` | text enum (`read`, `unread`) | Default `unread`. Drives the unread view (FR-014). |
| `archived` | integer boolean | Default `0`. `1` = in archive view, hidden from main list (FR-016). |
| `snapshot_path` | text, nullable | Local path under `data/snapshots/`; null if capture failed (FR-008). |
| `snapshot_type` | text enum (`webpage`, `pdf`), nullable | `pdf` reopens as PDF (FR-007); null when no snapshot. |
| `snapshot_available` | integer boolean | Default `0`; `1` when a snapshot was captured. |
| `created_at` | text ISO datetime | Sort key "date added" (FR-013). |
| `updated_at` | text ISO datetime | Set on any edit. |

**Validation rules**
- `address` rejected if not a well-formed http/https URL (FR-002); nothing saved on rejection.
- `normalized_url` computed on create; a create whose `normalized_url` already exists returns the existing bookmark for editing rather than inserting (FR-018), including when that existing one is archived.
- `title` never null after save; derived from address when no better value (FR-005).

**State transitions**
- Read status: `unread ⇄ read` (FR-014).
- Archive: `active → archived` (archive) and `archived → active` (restore); reversible (FR-016).
- Delete: permanent removal from any state; separate explicit, confirmed action (FR-017). Associated snapshot/thumbnail/favicon files are removed with the record.

## Entity: Tag

A short user-defined label for grouping and filtering.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer, PK | Auto-assigned. |
| `name` | text, required, unique | Case-insensitive unique; trimmed. |

## Relationship: Bookmark ⇄ Tag (many-to-many)

Join table `bookmark_tags`:

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer, FK → Bookmark.id | On delete cascade. |
| `tag_id` | integer, FK → Tag.id | On delete cascade. |

- A bookmark may carry many tags; a tag may apply to many bookmarks.
- Import maps Netscape folder names (`<H3>`) to tags on the contained bookmarks (FR-020). Tags created on demand.

## Derived views / query scopes

- **All (main list)**: `archived = 0`.
- **Unread**: `archived = 0 AND status = 'unread'` (FR-014).
- **Archive**: `archived = 1` (FR-016).
- **Search**: case-insensitive match of keyword against `title`, `address`, `description`, `notes`, or any associated tag `name` (FR-011), scoped to the current view.
- **Tag filter**: restrict to bookmarks associated with the selected tag (FR-012).
- **Sort**: `created_at` (date added) or `title`, ascending or descending (FR-013).

## Snapshot (conceptual, stored as files)

The captured copy of a bookmark's content at save time. Not a table; represented
by `snapshot_path` + `snapshot_type` + `snapshot_available` on Bookmark.
- `webpage` → single-file MHTML archive, reopened as a static page.
- `pdf` → original PDF bytes, reopened as a PDF (FR-006/FR-007).

## Empty states (UI, no schema impact)

Friendly empty states for: empty collection, empty unread view, empty archive
view, and empty search/filter results (FR-023).
