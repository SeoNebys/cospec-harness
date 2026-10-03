# Phase 1 Data Model: Bookmark Manager

Storage: single SQLite database file (`data/bookmarks.db`). Three tables model
the two entities from the spec plus their many-to-many relationship.

## Entity: Bookmark

Represents one saved link.

| Field        | Type              | Notes / Validation                                             |
|--------------|-------------------|----------------------------------------------------------------|
| `id`         | integer, PK       | Auto-assigned.                                                 |
| `url`        | text, required    | Normalized http/https URL. Must be a valid web address (FR-003). |
| `title`      | text, optional    | User-entered; may be empty (FR-002).                           |
| `notes`      | text, optional    | User-entered; may be empty (FR-002).                           |
| `created_at` | text (ISO 8601)   | Date saved; set by the system (Key Entities).                  |

Rules:
- `url` is stored in normalized form (scheme added if missing; see research).
- Duplicate `url` values are **allowed** but the save response flags them so the
  UI can warn (FR-011). No uniqueness constraint is enforced at the DB level.

## Entity: Tag

A short label used to group bookmarks.

| Field  | Type          | Notes / Validation                                  |
|--------|---------------|-----------------------------------------------------|
| `id`   | integer, PK   | Auto-assigned.                                      |
| `name` | text, required, unique | Trimmed, case-insensitive-unique short label. |

Rules:
- Tag names are unique; adding an existing tag name reuses the existing tag.
- Empty/whitespace-only tag names are rejected.

## Relationship: bookmark_tags (join)

Many-to-many between Bookmark and Tag.

| Field         | Type         | Notes                                             |
|---------------|--------------|---------------------------------------------------|
| `bookmark_id` | integer, FK  | References `bookmarks(id)`, cascade delete.       |
| `tag_id`      | integer, FK  | References `tags(id)`, cascade delete.            |

- Composite primary key (`bookmark_id`, `tag_id`) prevents duplicate links.
- Deleting a bookmark removes its links (FR-009). A tag with no remaining
  bookmarks may be left in place or pruned; pruning is optional and not required
  by the spec.

## Derived / query behaviour

- **List** (FR-005): all bookmarks with their tags, newest first by `created_at`.
- **Search** (FR-006): case-insensitive substring match of a keyword against
  `title`, `url`, and `notes`.
- **Tag filter** (FR-010): bookmarks linked to a given tag name.
- Search and tag filter may combine (keyword within a tag).

## Mapping to requirements

| Requirement | Model support |
|-------------|---------------|
| FR-001/002  | Bookmark.url + optional title/notes |
| FR-003      | url validation before insert |
| FR-004/SC-003 | SQLite file persistence |
| FR-005      | list query with tags |
| FR-006      | search query across title/url/notes |
| FR-007      | url returned to client to open |
| FR-008      | update of url/title/notes |
| FR-009      | delete cascades bookmark_tags |
| FR-010      | Tag + bookmark_tags + tag-filter query |
| FR-011      | duplicate-url detection flag on create |
| FR-012      | empty list / empty query result handled in UI |
