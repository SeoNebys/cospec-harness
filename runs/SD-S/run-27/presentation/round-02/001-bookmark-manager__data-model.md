# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in [spec.md](./spec.md).
Storage is SQLite; types below are logical.

## Entity: Bookmark

Represents one saved link.

| Field         | Type      | Required | Notes |
|---------------|-----------|----------|-------|
| id            | integer   | yes      | Primary key, auto-assigned |
| address       | text      | yes      | Valid absolute URL (FR-002). Normalized (scheme added if missing) |
| title         | text      | no       | User-entered; when absent, UI falls back to `address` (FR-003) |
| note          | text      | no       | Free-text note |
| created_at    | datetime  | yes      | Set on creation |
| updated_at    | datetime  | yes      | Updated on every edit |

**Validation rules**:
- `address` must parse as an absolute URL with an http/https scheme; reject
  otherwise (FR-002).
- On create, if `address` matches an existing bookmark's normalized address, return
  a non-blocking duplicate warning (FR-011) — the save still proceeds when confirmed.
- `title`, `note` are trimmed; empty strings stored as null.

## Entity: Tag

A short free-text label used to categorize bookmarks (FR-001, FR-007).

| Field | Type    | Required | Notes |
|-------|---------|----------|-------|
| id    | integer | yes      | Primary key |
| name  | text    | yes      | Unique (case-insensitive), trimmed, non-empty |

**Validation rules**:
- Tag names are trimmed and de-duplicated case-insensitively; created on demand when
  a user types a new tag.
- A tag with no associated bookmarks is not shown as a filter option (edge case) and
  may be pruned.

## Relationship: bookmark_tags (join)

Many-to-many between Bookmark and Tag.

| Field       | Type    | Notes |
|-------------|---------|-------|
| bookmark_id | integer | FK → Bookmark.id, cascade delete |
| tag_id      | integer | FK → Tag.id |

- A bookmark may have zero or more tags; a tag may apply to many bookmarks.
- Deleting a bookmark removes its join rows (FR-009); orphaned tags become
  ineligible as filters.

## Derived / query behavior

- **Search** (FR-006): case-insensitive match of a keyword against `title`,
  `address`, `note`, and any associated tag `name`.
- **Filter** (FR-007): restrict to bookmarks associated with a selected tag.
- **Available tags list**: distinct tag names that have at least one associated
  bookmark.
- **Ordering**: default list ordered by `created_at` descending (most recent first).

## Indexes

- Index on `bookmark_tags(tag_id)` and `bookmark_tags(bookmark_id)` for filtering.
- Index on `bookmarks(address)` for duplicate detection.
- Unique index on `tags(name COLLATE NOCASE)`.
