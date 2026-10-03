# Phase 1 Data Model: Bookmark Manager

Storage: embedded SQLite (`data/bookmarks.db`). Binary offline copies live on the
filesystem under `data/snapshots/` and are referenced by bookmark id. Single user,
so there is no user/account entity.

## Entity: Bookmark

The saved web page (spec Key Entities → Bookmark).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | Auto-increment. |
| `url` | text, required | Original address as entered. |
| `normalized_url` | text, required, **unique** | For duplicate detection (research §9). Unique index enforces FR-006. |
| `title` | text | Auto-captured; editable; fallback derived from URL when missing (FR-003/005). |
| `description` | text | Auto-captured; editable (FR-002/003). |
| `notes_html` | text | Sanitized rich-note HTML (FR-027). |
| `favicon_url` | text | Absolute URL (or cached path) of favicon (FR-002/008). |
| `preview_image_url` | text | Absolute URL of `og:image`/preview (FR-002). |
| `is_read` | integer (0/1) | Read-later state; default `0` = unread (FR-021). |
| `is_archived` | integer (0/1) | Archive flag; default `0` (FR-025/026). |
| `saved_date` | integer (epoch ms) | Set on create; sortable; preserved on import (FR-011/031). |
| `updated_date` | integer (epoch ms) | Last modification time. |
| `offline_status` | text enum | `available` \| `unavailable` \| `pending`. Default `pending`, set by capture (FR-029). |
| `offline_kind` | text enum, nullable | `mhtml` \| `pdf` when available. |
| `offline_path` | text, nullable | Relative path under `data/snapshots/` when available. |
| `ia_status` | text enum | `none` \| `pending` \| `saved` \| `failed`. Default `none` (FR-030). |
| `ia_snapshot_url` | text, nullable | Internet Archive snapshot link when saved. |

**Validation**
- `url` required and must parse to a valid http(s) address after normalization
  (FR-004); otherwise reject (nothing saved).
- `normalized_url` unique — insert conflict resolves to "open existing" (FR-006).
- `title` non-empty after save (fallback applied if capture yields none, FR-005).
- `notes_html` passes server-side sanitization allowlist before persistence.

**State transitions**
- Read: `is_read` 0 ↔ 1 (single or bulk).
- Archive: `is_archived` 0 → 1 (archive) and 1 → 0 (restore); reversible, distinct
  from delete (hard removal). Archived rows are excluded from normal list/search.
- Offline: `pending` → `available` (with kind+path) or `pending` → `unavailable`.
- Internet Archive: `none` → `pending` → `saved` (with url) | `failed` (retryable).

## Entity: Tag

User-defined label (spec Key Entities → Tag). Many-to-many with bookmarks.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | Auto-increment. |
| `name` | text, required, **unique** (case-insensitive) | Canonical tag label; powers suggestions (FR-018) and `#tag` search (FR-014). |

**Join: bookmark_tags**

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer, FK → Bookmark.id | On delete cascade. |
| `tag_id` | integer, FK → Tag.id | On delete cascade. |

- PK `(bookmark_id, tag_id)`. A bookmark has many tags; a tag applies to many
  bookmarks.
- Tags with no remaining bookmarks may be pruned (keeps suggestions relevant).

## Entity: SavedFilter

Named, reusable search + tag inclusion/exclusion (spec Key Entities → Saved
Filter; FR-028).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | Auto-increment. |
| `name` | text, required, **unique** | Display name for reuse. |
| `query` | text | Search query string (may be empty). |
| `include_tags` | text (JSON array of tag names) | AND-combined inclusions. |
| `exclude_tags` | text (JSON array of tag names) | Exclusions. |
| `created_date` | integer (epoch ms) | |

- Applying a saved filter = evaluate `query` AND include all `include_tags` AND
  none of `exclude_tags`, over non-archived bookmarks.

## Entity: Preferences

Single-row table for the one user's display settings (spec Key Entities →
Preferences; FR-033).

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer, PK | Always `1` (single row). |
| `default_sort` | text enum | `date_added_desc` (default) \| `date_added_asc` \| `title_asc` \| `title_desc`. |
| `density` | text enum | `comfortable` (default) \| `compact`. Controls how much each row shows. |
| `text_size` | text enum | `small` \| `medium` (default) \| `large`. |

## Relationships (summary)

```text
Bookmark 1───* bookmark_tags *───1 Tag        (many-to-many)
SavedFilter references Tag names (by value, not FK) for include/exclude
Preferences: single row, no relationships
Bookmark 1───0..1 offline snapshot file (data/snapshots/<id>.<mhtml|pdf>)
```

## Indexes

- `UNIQUE(bookmarks.normalized_url)` — duplicate detection.
- `INDEX(bookmarks.is_archived, is_read)` — list/unread/archive views.
- `INDEX(bookmarks.saved_date)`, `INDEX(bookmarks.title)` — sorting.
- `UNIQUE(tags.name COLLATE NOCASE)` — case-insensitive tag identity.
- Text search uses `LIKE` (case-insensitive) over title/description/notes/url,
  composed by the search evaluator (research §6); FTS is intentionally not used
  because the requested boolean/quoting semantics are handled by the custom parser.

## Derived / non-persisted

- **Fallback title**: computed from `normalized_url` when capture yields none;
  stored into `title` so the list always shows something (FR-003/005).
- **"Select all matching" set**: not stored; resolved on demand by re-running the
  active query/filter server-side for bulk actions (research §10).
