# Phase 1 Data Model: Bookmark Manager

Persisted in a local SQLite database (`data/bookmarks.db`). Preserved page
copies are files under `data/preserved/`, referenced by path. Entities derive
directly from the spec's **Key Entities** and functional requirements.

## Entity: Bookmark

Represents a saved reference to a web resource.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer, PK | Auto-generated unique identifier. |
| `url` | text, required | The address as entered/edited by the user. |
| `normalized_url` | text, required, **UNIQUE** | Normalization of `url` (FR-002); the duplicate-detection key (FR-007). |
| `title` | text, required | User-editable; falls back to derived/host value when metadata missing (FR-003/FR-005). |
| `description` | text, nullable | Auto-collected; user-editable (FR-004). |
| `icon_url` | text, nullable | Site icon location (FR-003, list display FR-033). |
| `preview_image_url` | text, nullable | Preview image (`og:image`) (FR-003). |
| `notes_markdown` | text, nullable | Formatted note source (Markdown) (FR-025). |
| `is_read` | boolean, default false | Read-later status (FR-015). |
| `is_archived` | boolean, default false | Archived status (FR-017/FR-018). |
| `date_added` | timestamp, required | Set on creation (FR-006); overridden by import original date (FR-030). |
| `date_modified` | timestamp, required | Updated on any edit. |
| `metadata_status` | enum: `pending`/`ready`/`failed` | Async capture state (FR-005). |
| `preserved_path` | text, nullable | Path to local copy file (FR-026/FR-027). |
| `preserved_kind` | enum: `html`/`pdf`, nullable | Self-contained HTML vs original PDF. |
| `preserved_status` | enum: `none`/`pending`/`ready`/`failed` | Local preservation state (FR-029). |
| `archive_org_url` | text, nullable | Internet Archive snapshot reference (FR-028). |
| `archive_org_status` | enum: `none`/`pending`/`ready`/`failed` | IA submission state (FR-029). |

**Relationships**: many-to-many with **Tag** (via `bookmark_tags`).

**Validation**:
- `url` must be a well-formed web URL after normalization; empty/malformed rejected (FR-002).
- `normalized_url` UNIQUE enforces no duplicates at the DB layer (FR-007, SC-003).
- Editing `url` re-runs normalization + duplicate check before persisting (FR-004).

**State transitions**:
- Read: `is_read` toggles false↔true (FR-015).
- Archive: `is_archived` false→true (archive) and true→false (restore) (FR-017/FR-019).
- Async fields (`metadata_status`, `preserved_status`, `archive_org_status`) move
  `pending`→`ready`/`failed` independently and never block save (FR-005/FR-029).

## Entity: Tag

A user-defined label.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer, PK | Unique identifier. |
| `name` | text, required, **UNIQUE (case-insensitive)** | Normalized for merge on import (FR-031). |

**Relationships**: many-to-many with **Bookmark**.
**Rules**: typing suggests existing tags (FR-009); a new name creates a tag
(US3); same-named tags merge rather than duplicate (FR-031).

## Join: bookmark_tags

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer, FK → Bookmark | ON DELETE CASCADE. |
| `tag_id` | integer, FK → Tag | ON DELETE CASCADE. |

Composite PK `(bookmark_id, tag_id)`. Supports tag filtering (FR-010), `#tag`
search (FR-013), and bulk add/remove tags (FR-023).

## Entity: Saved View

A named, reusable combination of search text plus included/excluded tags.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer, PK | Unique identifier. |
| `name` | text, required | Display name. |
| `search_text` | text, nullable | The search expression (FR-024). |
| `included_tags` | text (JSON array), nullable | Tag names that must be present. |
| `excluded_tags` | text (JSON array), nullable | Tag names that must be absent. |

Reopening restores the same search + tag inclusion/exclusion (FR-024).

## Entity: Display Preferences

Single-row (one user) settings table.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer, PK (always 1) | Singleton row. |
| `default_sort` | enum: `newest`/`oldest`/`title`/`recently_modified` | Default list order (FR-021/FR-035). |
| `items_per_view` | integer | How many items shown at once (FR-035). |
| `text_size` | enum: `small`/`medium`/`large` | UI text size (FR-035). |

Applied and persisted across sessions (FR-035).

## Derived / not stored separately

- **Preserved Copy** and **Internet Archive Reference** from the spec are modeled
  as fields on **Bookmark** (`preserved_*`, `archive_org_*`) plus the on-disk file
  at `preserved_path`, rather than separate tables — each bookmark has at most one
  of each, so a 1:1 field set is simpler than a join.

## Indexes (for SC-004 responsiveness at 1,000+ bookmarks)

- UNIQUE index on `bookmark.normalized_url` (duplicate detection).
- Index on `bookmark.is_archived`, `bookmark.is_read`, `bookmark.date_added`,
  `bookmark.title` to keep normal-view filtering and sorting fast.
- Index on `bookmark_tags.tag_id` for tag filtering and `#tag` search joins.
- UNIQUE (case-insensitive) index on `tag.name`.

## Query-visibility rules

- **Normal browsing and search**: `is_archived = false` only (FR-018).
- **Unread view**: `is_archived = false AND is_read = false` (FR-016).
- **Archive view**: `is_archived = true` only (FR-018).
