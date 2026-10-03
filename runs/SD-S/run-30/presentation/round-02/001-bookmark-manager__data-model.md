# Phase 1 Data Model: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-27
**Storage**: SQLite (`data/bookmarks.db`)

Derived from the spec's Key Entities (Bookmark, Tag) and the single-user access
model (FR-015 — no user/account entity).

## Entities

### Bookmark

A saved web page.

| Field        | Type              | Constraints                                            | Source |
|--------------|-------------------|--------------------------------------------------------|--------|
| id           | integer           | Primary key, auto-increment                            | —      |
| url          | text              | Required; valid http/https; stored as entered          | FR-001, FR-002 |
| url_norm     | text              | Required; unique; normalized form used for dedupe      | FR-013 |
| title        | text              | Required; falls back to `url` when none derived        | FR-003 |
| note         | text              | Optional; may be empty                                 | FR-004 |
| created_at   | text (ISO-8601)   | Required; set on creation                              | FR-006 |
| updated_at   | text (ISO-8601)   | Required; set on creation and each edit                | FR-010 |

**Validation rules**:
- `url` MUST parse as a WHATWG URL with scheme `http` or `https`; otherwise the
  save is rejected with a clear message (FR-002).
- `url_norm` is derived: trim, lowercase scheme and host, drop default port, drop
  a single trailing slash. Uniqueness is enforced on `url_norm` (FR-013).
- `title` defaults to the fetched page `<title>`, or to `url` if none (FR-003).

### Tag

A short label used to group bookmarks.

| Field | Type    | Constraints                          | Source |
|-------|---------|--------------------------------------|--------|
| id    | integer | Primary key, auto-increment          | —      |
| name  | text    | Required; unique; trimmed, non-empty | FR-005 |

### BookmarkTag (join)

Associates bookmarks and tags many-to-many.

| Field       | Type    | Constraints                                   |
|-------------|---------|-----------------------------------------------|
| bookmark_id | integer | FK → bookmarks.id, ON DELETE CASCADE          |
| tag_id      | integer | FK → tags.id, ON DELETE CASCADE               |

Primary key `(bookmark_id, tag_id)`.

## Relationships

- A **Bookmark** has zero or more **Tags** (via BookmarkTag).
- A **Tag** applies to zero or more **Bookmarks**.
- Deleting a bookmark removes its BookmarkTag rows (cascade). Tags with no
  remaining bookmarks may be left in place or pruned (implementation detail;
  pruning keeps the tag-filter list clean).

## Derived / query behavior

- **List** (FR-006): bookmarks ordered by `created_at` descending (newest first),
  each with its tags attached.
- **Search** (FR-007): case-insensitive match of a keyword against `title`, `url`,
  and `note`.
- **Tag filter** (FR-008): bookmarks having a BookmarkTag row for the selected
  tag. Search and tag filter combine (both applied when both are present).
- **Distinct tags**: list of tag names in use, for the filter UI.

## Notes

- No `User` entity: the app is single-user with no login (FR-015).
- Timestamps are stored as ISO-8601 text for portability.
