# Phase 1 Data Model: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-18

Derived from the Key Entities and Functional Requirements in
[spec.md](./spec.md). Persistence is SQLite (see [research.md](./research.md)).

## Entity: Bookmark

A saved reference to a web page.

| Field         | Type      | Required | Notes |
|---------------|-----------|----------|-------|
| `id`          | integer   | yes      | Primary key, auto-assigned. |
| `url`         | text      | yes      | Normalized absolute address, `http`/`https` only (FR-002, FR-003). |
| `title`       | text      | no       | User-provided display title. |
| `notes`       | text      | no       | Free-text notes (FR-001). |
| `date_added`  | timestamp | yes      | Set on creation; drives default ordering (FR-014). |
| `date_updated`| timestamp | yes      | Set on creation and every edit (FR-007). |

**Derived / behavioural**

- **Display label** (FR-004): `title` when non-empty; otherwise a label derived from
  `url` (host + path). Computed at read time, not stored.
- **Tags** (FR-010): zero or more `Tag` values associated via `BookmarkTag`.

**Validation rules**

- `url` MUST parse via the WHATWG URL API after scheme normalization; reject otherwise
  (FR-002).
- Scheme-less input (e.g. `example.com`) is normalized to `https://example.com`
  before storage (FR-003).
- On create, if an identical normalized `url` already exists, the API returns a
  duplicate warning but still allows a deliberate save (FR-013).

## Entity: Tag

A short user-defined label for grouping and filtering.

| Field   | Type    | Required | Notes |
|---------|---------|----------|-------|
| `id`    | integer | yes      | Primary key. |
| `name`  | text    | yes      | Unique (case-insensitive), trimmed, non-empty. |

## Relationship: BookmarkTag (many-to-many)

| Field         | Type    | Notes |
|---------------|---------|-------|
| `bookmark_id` | integer | FK → Bookmark.id, cascade delete. |
| `tag_id`      | integer | FK → Tag.id. |

- A bookmark may have many tags; a tag may apply to many bookmarks.
- Deleting a bookmark removes its `BookmarkTag` rows (FR-008). Tags with no remaining
  bookmarks may be left as-is or pruned; pruning is optional for v1.

## State & lifecycle

Bookmarks have no complex state machine. Lifecycle:

1. **Created** — via save (FR-001), after validation/normalization.
2. **Updated** — title/url/notes/tags edited (FR-007); `date_updated` refreshed.
3. **Deleted** — removed after explicit confirmation (FR-008); cascade removes tag links.

## Query behaviour

- **List** (FR-005, FR-014): all bookmarks, default order `date_added` DESC.
- **Search** (FR-011): case-insensitive keyword match against `title`, `url`, `notes`,
  and associated tag names.
- **Filter by tag** (FR-010): restrict to bookmarks linked to a given tag.
- **Empty / no-results states** (FR-012): a list request that yields zero rows is a
  valid response the client renders as the appropriate empty or no-results state.
