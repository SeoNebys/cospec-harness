# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in [spec.md](./spec.md).
Storage: SQLite. Times stored as ISO-8601 UTC text.

## Entity: Bookmark

Represents one saved link.

| Field         | Type    | Rules                                                                 |
|---------------|---------|----------------------------------------------------------------------|
| id            | integer | Primary key, auto-assigned.                                          |
| url           | text    | Required. Normalized (scheme added if omitted, FR-003). **Unique** (FR-019). Must be a well-formed http/https URL (FR-002). |
| title         | text    | Auto-collected or user-edited (FR-004, FR-005). Falls back to host when unavailable (FR-006). |
| description   | text    | Auto-collected or user-edited; may be empty.                        |
| favicon_url   | text    | Absolute URL to the site's icon; may be empty → UI shows placeholder. |
| created_at    | text    | Set once on creation (FR-013).                                       |
| updated_at    | text    | Set on creation and each edit.                                      |

**Validation**
- `url` rejected if not a valid http/https URL after normalization → save fails
  with a clear message, nothing stored (FR-002).
- Saving a `url` equal (after normalization) to an existing bookmark's `url` does
  not insert; the existing bookmark is returned instead (FR-019).

**Ordering**: Default list order is `created_at` descending (newest first, FR-013).

## Entity: Tag

A short user-defined label.

| Field    | Type    | Rules                                                                 |
|----------|---------|----------------------------------------------------------------------|
| id       | integer | Primary key, auto-assigned.                                          |
| name     | text    | Display name, trimmed of surrounding whitespace (FR-015).           |
| norm_key | text    | Lowercased, trimmed form of `name`. **Unique** — enforces case-insensitive de-duplication (FR-015). |

**Behavior**
- Creating/assigning a tag whose `norm_key` already exists reuses the existing
  tag rather than creating a second (FR-014, FR-015).
- The set of existing tag names is offered as suggestions when tagging (FR-014).

## Relationship: Bookmark ↔ Tag (many-to-many)

Join entity `bookmark_tags`.

| Field       | Type    | Rules                                             |
|-------------|---------|---------------------------------------------------|
| bookmark_id | integer | References Bookmark.id; row removed when bookmark is deleted (cascade). |
| tag_id      | integer | References Tag.id.                                |

- Composite uniqueness on (bookmark_id, tag_id) — a tag applies to a bookmark at
  most once.
- A bookmark may carry many tags; a tag may apply to many bookmarks (FR-014).
- Filtering by a tag returns bookmarks with a matching join row (FR-016).

## Derived / query behavior

- **Search** (FR-017): case-insensitive match of a term against a bookmark's
  title, description, url, or any associated tag name. Combinable with an active
  tag filter (results satisfy both).
- **Tag filter** (FR-016): restrict to bookmarks linked to the chosen tag;
  clearable to show all.
- **Empty / no-results states** (FR-018): distinguish "no bookmarks exist at all"
  from "current search/filter matched nothing."

## Lifecycle notes

- Deleting a bookmark removes its `bookmark_tags` rows (cascade). A tag that ends
  up linked to no bookmarks may remain as a suggestion; it is harmless and out of
  scope to prune in v1.
- No user/account entity exists — single-user v1 (spec Assumptions).
