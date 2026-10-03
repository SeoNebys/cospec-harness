# Phase 1 Data Model: Bookmark Manager

Local SQLite database (`data/bookmarks.db`). Single-user; no owner/account fields
in v1.

## Entity: Bookmark

Represents one saved web page.

| Field           | Type      | Notes |
|-----------------|-----------|-------|
| id              | integer   | Primary key, auto-increment |
| url             | text      | The web address; required; well-formed http/https |
| url_normalized  | text      | Normalized address for duplicate detection; unique |
| title           | text      | Display title; auto-derived, falls back to `url` |
| created_at      | text      | ISO-8601 timestamp when saved (FR-014) |
| updated_at      | text      | ISO-8601 timestamp of last edit |

**Validation rules**:

- `url` MUST be non-empty and a well-formed `http`/`https` URL (FR-001, FR-002).
- `url_normalized` MUST be unique; a save whose normalized URL already exists is
  rejected as a duplicate with a warning (FR-011).
- `title` MUST be present after save: derived from the page, else set to `url`
  (FR-003). User may overwrite it (FR-004, FR-009).

**Ordering**: Lists are returned ordered by `created_at` descending — most recent
first (FR-006).

## Entity: Tag

A short user-defined label for grouping bookmarks (FR-012).

| Field | Type    | Notes |
|-------|---------|-------|
| id    | integer | Primary key, auto-increment |
| name  | text    | Label text; unique (case-insensitive); non-empty, trimmed |

## Relationship: Bookmark ↔ Tag (many-to-many)

Join table `bookmark_tags`.

| Field       | Type    | Notes |
|-------------|---------|-------|
| bookmark_id | integer | FK → Bookmark.id, ON DELETE CASCADE |
| tag_id      | integer | FK → Tag.id, ON DELETE CASCADE |

- A bookmark may carry many tags; a tag may apply to many bookmarks.
- Composite primary key `(bookmark_id, tag_id)` prevents duplicate assignments.
- Deleting a bookmark removes its tag associations (cascade); a tag no longer used
  by any bookmark may be pruned (optional housekeeping, not user-visible).

## Derived behaviors

- **Search** (FR-007): case-insensitive substring match of a keyword against
  `title` OR `url`, returned newest-first. Empty result yields the no-results
  state (FR-013).
- **Tag filter** (FR-012): return bookmarks associated with the selected tag,
  newest-first. Empty result yields the no-results state (FR-013).
- **Empty state** (FR-013): when no bookmarks exist at all, the list endpoint
  returns an empty collection and the UI shows the empty state.

## Schema (reference)

```sql
CREATE TABLE bookmarks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  url            TEXT NOT NULL,
  url_normalized TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);
```
