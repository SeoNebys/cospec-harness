# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in [spec.md](./spec.md).

## Entity: Bookmark

A saved reference to a web page.

| Field         | Type      | Rules                                                        |
|---------------|-----------|-------------------------------------------------------------|
| id            | integer   | Primary key, generated.                                     |
| address       | text      | Required. Normalized web URL (http/https). **Unique** across all bookmarks (FR-010). |
| title         | text      | Required after save; derived from page/address if not given (FR-011). |
| description   | text      | Optional. May be empty.                                     |
| is_read       | boolean   | Defaults to `false` (unread) on create (FR-014).            |
| is_archived   | boolean   | Defaults to `false` on create (FR-016).                     |
| created_at    | timestamp | Set on creation; used for default "newest first" order (FR-013). |
| updated_at    | timestamp | Updated on any edit/state change.                           |

### Validation rules

- **address**: must parse as an http/https URL after normalization (add
  `https://` when scheme missing); otherwise the save is rejected (FR-002).
- **uniqueness**: a normalized address may exist on at most one bookmark. On a
  create or edit that collides, the app does not create/keep a duplicate; it
  routes the user to the existing bookmark for editing (FR-010).
- **title**: never stored empty — falls back to a value derived from the address.

### State transitions

- Read state: `unread ⇄ read` (FR-014). New bookmarks start `unread`.
- Archive state: `active ⇄ archived` (FR-016, FR-017). New bookmarks start
  `active`. Archived bookmarks are excluded from the main list and the unread
  view (FR-016, SC-007) and appear only in the archive view.
- Deletion: permanent removal, allowed from the main flow (FR-007) and from the
  archive view (FR-018); requires confirmation.

## Entity: Tag

A short label used to categorize bookmarks.

| Field | Type    | Rules                                  |
|-------|---------|----------------------------------------|
| id    | integer | Primary key, generated.                |
| name  | text    | Required, unique, trimmed, lowercased. |

## Relationship: Bookmark ⇄ Tag (many-to-many)

A join between bookmarks and tags; a bookmark may have many tags and a tag may
apply to many bookmarks.

| Field       | Type    | Rules                               |
|-------------|---------|-------------------------------------|
| bookmark_id | integer | References Bookmark(id), cascade delete. |
| tag_id      | integer | References Tag(id).                 |

- Composite uniqueness on (bookmark_id, tag_id).
- Tags with no remaining bookmarks may be pruned (optional housekeeping).

## Derived views / queries (from requirements)

- **Main list**: bookmarks where `is_archived = false`, ordered by `created_at`
  descending (FR-004, FR-013).
- **Read-later (unread) view**: bookmarks where `is_archived = false AND
  is_read = false` (FR-015).
- **Archive view**: bookmarks where `is_archived = true` (FR-017).
- **Search**: case-insensitive match of a keyword against title, address,
  description, or any tag name (FR-008), scoped to the active view.
- **Tag filter**: bookmarks carrying a selected tag (FR-009), scoped to the
  active view.
