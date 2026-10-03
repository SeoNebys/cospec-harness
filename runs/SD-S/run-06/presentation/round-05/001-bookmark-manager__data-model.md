# Phase 1 Data Model: Bookmark Manager

Storage: local SQLite (`data/bookmarks.db`). Three tables model bookmarks, tags,
and their many-to-many relationship.

## Entity: Bookmark

Represents a saved reference to a web page (spec Key Entities).

| Field           | Type    | Notes |
|-----------------|---------|-------|
| id              | INTEGER | Primary key, autoincrement |
| address         | TEXT    | Original web address as entered/displayed; used to open the page. Required, must be a well-formed http/https URL (FR-002) |
| normalized_key  | TEXT    | Lowercased scheme+host with one trailing slash stripped from path; UNIQUE (FR-014/FR-015) |
| title           | TEXT    | Display title; auto-collected or address-derived fallback (FR-003/FR-004) |
| description     | TEXT    | Auto-collected description; may be empty (FR-004) |
| icon_url        | TEXT    | Auto-collected icon address; may be empty (FR-004) |
| created_at      | TEXT    | ISO timestamp; drives most-recently-added-first ordering (FR-006) |
| updated_at      | TEXT    | ISO timestamp; set on edit |

**Validation rules**:
- `address` must parse as an http/https URL, else reject (FR-002).
- `normalized_key` is unique; an insert colliding on it means the address is
  already bookmarked (FR-014 → open existing for update).
- On save, if metadata cannot be collected, `title` falls back to the host/last
  path segment of the address; `description` and `icon_url` remain empty (FR-004).

## Entity: Tag

A short reusable label (spec Key Entities).

| Field | Type    | Notes |
|-------|---------|-------|
| id    | INTEGER | Primary key, autoincrement |
| name  | TEXT    | Tag label; UNIQUE (case-insensitive) so the same tag is not stored twice (FR-009) |

**Validation rules**:
- `name` trimmed, non-empty.
- Uniqueness is case-insensitive (`news` and `News` are the same tag) so reuse
  does not create duplicates (FR-009).
- A tag with no remaining bookmark associations is not offered for filter/reuse
  (spec edge case); it may be removed when its last association is deleted.

## Relationship: bookmark_tags (many-to-many)

| Field       | Type    | Notes |
|-------------|---------|-------|
| bookmark_id | INTEGER | FK → Bookmark.id, ON DELETE CASCADE |
| tag_id      | INTEGER | FK → Tag.id, ON DELETE CASCADE |

- Primary key `(bookmark_id, tag_id)` prevents applying the same tag twice to one
  bookmark.
- A bookmark can carry many tags; a tag can apply to many bookmarks (FR-009).

## Derived / query behavior

- **List** (FR-006): all bookmarks with their tags, ordered by `created_at` DESC.
- **Tag filter** (FR-010): bookmarks having a `bookmark_tags` row for the selected
  tag; cleared filter returns all.
- **Search** (FR-011): case-insensitive match of the term against `title`,
  `description`, `address`, or any associated tag `name`. Combines with an active
  tag filter (both narrow the list).
- **Duplicate detection** (FR-014/FR-015): compute `normalized_key` from the
  submitted address; if a bookmark with that key exists, return it for update
  rather than inserting.
- **Ordering stability**: `created_at` is not changed on edit; `updated_at`
  reflects edits.

## State / lifecycle

A bookmark is created (save) → optionally enriched (metadata arrives) → edited
(address/title/description; re-validated) → deleted (confirmation, cascade removes
its tag associations). No other states.
