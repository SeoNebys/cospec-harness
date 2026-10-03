# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and Functional Requirements. Storage is
SQLite (`data/bookmarks.db`).

## Entity: Bookmark

Represents one saved web page.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer | Primary key, auto-increment. |
| `url` | text | Normalized, openable address. Required, non-empty. Must be valid http/https (FR-002/FR-003). |
| `normalized_url` | text | Canonical form used for duplicate detection (FR-011). Unique. Derived from `url` (research §9). |
| `title` | text | Auto-fetched, user-editable (FR-004/FR-004a). Defaults to a URL-derived title until enrichment or if enrichment fails (FR-004b). |
| `description` | text | Auto-fetched, user-editable. Nullable/empty when absent. |
| `favicon_url` | text | Auto-fetched reference URL. Nullable. |
| `preview_image_url` | text | Auto-fetched reference URL (og:image). Nullable. |
| `notes` | text | User-authored free text (FR-001). Nullable. |
| `enrichment_status` | text | One of `pending`, `ready`, `failed`. Drives background-fill UI (research §3). |
| `date_saved` | text (ISO-8601) | Timestamp set at creation (FR-013). Used for default ordering (FR-005, most recent first). |

**Validation rules**
- `url` must parse as http/https with a host; otherwise creation is rejected
  (FR-002). Scheme-less input is normalized to `https://` first (FR-003).
- `normalized_url` must be unique; an attempt to create a matching one triggers
  the "edit existing" flow rather than an insert (FR-011).
- On create: `enrichment_status = pending`, `title` = URL-derived fallback,
  `date_saved` = now.
- On edit: `title`, `description`, `url` (+`normalized_url`), `notes`, and tags
  may change; edits re-run URL validation (FR-009). Editing `url` may re-trigger
  enrichment.

**State transitions (enrichment_status)**
```
pending ──(metadata fetched & parsed)──▶ ready
pending ──(timeout / non-2xx / non-HTML / network error)──▶ failed
```
`ready` and `failed` are terminal for a given save. Editing the `url` resets the
status to `pending` and re-enriches.

## Entity: Tag

A short label for grouping bookmarks (FR-014).

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer | Primary key, auto-increment. |
| `name` | text | Label text. Required, non-empty, trimmed, unique (case-insensitive). |

## Relationship: Bookmark ↔ Tag (many-to-many)

Join table `bookmark_tags`:

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer | FK → `bookmarks.id`, `ON DELETE CASCADE`. |
| `tag_id` | integer | FK → `tags.id`, `ON DELETE CASCADE`. |

- Primary key `(bookmark_id, tag_id)` prevents duplicate assignments.
- Deleting a bookmark cascades its tag links (FR-010). A tag with no remaining
  bookmarks may be pruned or left orphaned (v1: leave; harmless).

## Indexes

- Unique index on `bookmarks.normalized_url` (dedupe lookups, FR-011).
- Index on `bookmarks.date_saved` (default ordering, FR-005).
- Unique index on `tags.name` (case-insensitive).
- Index on `bookmark_tags.tag_id` (tag filtering, FR-014).

## Derived / computed for API responses

- A bookmark serialized to the client includes its `tags` as an array of tag
  names (joined from `bookmark_tags`).
- Keyword search matches case-insensitive substrings of `title`, `url`, and
  `description` (research §7).
