# Phase 1 Data Model: Bookmark Manager

Local SQLite database (`data/bookmarks.db`). Preserved page files live under
`data/preserved/` and are referenced by path from the `bookmark` row.

## Entities

### bookmark
Represents one saved web reference.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| url | text, required | Original address as entered/edited |
| canonical_key | text, required, unique | Normalised address for duplicate detection (see `normalize.js`) |
| title | text | Auto-fetched; user-editable; derived from address if unavailable |
| description | text | Auto-fetched; user-editable |
| icon_url | text | Page icon/favicon reference or stored asset path |
| preview_image_url | text | OpenGraph/preview image reference |
| note_html | text | Sanitised rich-text note (allow-listed HTML) |
| is_unread | integer (0/1), default 0 | 1 only if "read later" chosen at save or set later (FR-016) |
| is_archived | integer (0/1), default 0 | Archived rows excluded from normal list/search (FR-017) |
| preserved_path | text | Path under `data/preserved/` to self-contained HTML or PDF (FR-024) |
| preserved_kind | text | `html` \| `pdf` \| null |
| archive_org_url | text | Internet Archive snapshot reference, if submitted (FR-025) |
| date_added | text (ISO 8601), required | Preserved on import when present (FR-022) |
| updated_at | text (ISO 8601) | |

**Validation**: `url` must be a well-formed http(s) address (FR-005);
`canonical_key` uniqueness enforces no duplicates (FR-006, FR-023).

**State transitions**:
- read ⇄ unread (`is_unread` toggled).
- active → archived → active (archive / restore).
- any → deleted (permanent, requires confirmation; row removed).

### tag
A reusable label.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| name | text, required, unique (case-insensitive) | Displayed as entered |

### bookmark_tag
Many-to-many join between bookmarks and tags.

| Field | Type | Notes |
|-------|------|-------|
| bookmark_id | integer FK → bookmark.id, cascade delete | |
| tag_id | integer FK → tag.id | |

Primary key `(bookmark_id, tag_id)`. Bulk tag add/remove operate as deltas on
these rows and never clear a bookmark's other associations (FR-019). Tag
suggestions come from distinct `tag.name` with usage counts (FR-009).

### saved_search
A reusable named query with included/excluded tag sets.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| name | text, required, unique | |
| query | text | Search-grammar string (may be empty) |
| included_tags | text (JSON array of tag names) | |
| excluded_tags | text (JSON array of tag names) | |
| created_at | text (ISO 8601) | |

Selecting reapplies query + included + excluded (FR-021).

### preferences
Single-row per-user display settings.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK (always 1) | Singleton |
| default_sort | text | e.g. `date_added_desc` \| `title_asc` (FR-012/FR-027) |
| items_per_view | integer | Page size (FR-027) |
| text_size | text | e.g. `small` \| `medium` \| `large` (FR-027) |

## Relationships

```text
bookmark 1 ──< bookmark_tag >── 1 tag        (many-to-many)
bookmark 1 ──  preserved file (0..1)          (preserved_path/kind)
saved_search  references tag names by value   (included_tags / excluded_tags)
preferences   singleton
```

## Derived views (queries, not stored)

- **Main list**: bookmarks where `is_archived = 0`, ordered by preference sort.
- **Unread view**: `is_archived = 0 AND is_unread = 1`.
- **Archive view**: `is_archived = 1`.
- **Search result**: candidate rows (respecting the active view's archive
  filter) passed through the search-grammar evaluator (see `search.js`).
