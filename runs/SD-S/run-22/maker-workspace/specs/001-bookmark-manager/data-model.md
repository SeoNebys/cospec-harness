# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in [spec.md](./spec.md).

## Entity: Bookmark

A saved link.

| Field         | Type                | Notes                                                        |
|---------------|---------------------|-------------------------------------------------------------|
| `id`          | integer (PK)        | Stable identifier, generated.                                |
| `url`         | string              | Normalized web address (http/https). Required. See rules.    |
| `title`       | string              | Human-readable title. Required after derivation (FR-003).    |
| `note`        | string \| null      | Optional free-text note (FR-001).                           |
| `created_at`  | timestamp (UTC)     | Set on creation; used for default ordering (FR-005).        |
| `updated_at`  | timestamp (UTC)     | Set on creation and each edit (FR-007).                     |

**Relationships**: A Bookmark has many Tags (many-to-many via `bookmark_tags`).

**Validation rules**:

- `url` MUST parse to a valid `http`/`https` URL after normalization; otherwise the
  bookmark is rejected (FR-002). Normalization assumes `https://` when no scheme is
  supplied (edge case).
- `title` MUST be non-empty; when the user omits it, it is derived (page title if
  reachable, else the URL host/path) before persistence (FR-003).
- `note` is optional and may be empty/null.
- Saving a bookmark whose normalized `url` matches an existing one succeeds but
  returns a duplicate warning (FR-012); it does not block creation.
- Long `title`/`url` values are stored in full (display truncation is a UI concern).

**State**: Bookmarks have no workflow states. Lifecycle: created → (optionally
edited) → deleted. Deletion requires explicit confirmation (FR-008) and is
permanent in v1.

## Entity: Tag

A short label used to group bookmarks.

| Field   | Type         | Notes                                            |
|---------|--------------|--------------------------------------------------|
| `id`    | integer (PK) | Generated identifier.                            |
| `name`  | string       | Unique, normalized (trimmed, case-insensitive).  |

**Relationships**: A Tag applies to many Bookmarks (many-to-many).

**Validation rules**:

- `name` is trimmed and treated case-insensitively for uniqueness; empty tags are
  ignored.
- Tags are created on demand when first assigned to a bookmark.

## Association: bookmark_tags

Join between Bookmark and Tag (many-to-many, FR-010).

| Field         | Type          | Notes                              |
|---------------|---------------|------------------------------------|
| `bookmark_id` | integer (FK)  | References `bookmarks.id`.         |
| `tag_id`      | integer (FK)  | References `tags.id`.              |

- Composite uniqueness on (`bookmark_id`, `tag_id`) — a tag applies to a bookmark
  at most once.
- Deleting a bookmark removes its associations. A tag with no remaining bookmarks
  may be cleaned up (implementation detail; not user-visible).

## Derived views / queries (support requirements)

- **List (default)**: all bookmarks ordered by `created_at` descending (FR-005).
- **Search**: bookmarks where a keyword matches `title`, `url`, or any tag `name`
  (FR-006). Empty result set yields an empty state, not an error (FR-011).
- **Tag filter**: bookmarks carrying a given tag (FR-010).

## Indexing notes (for SC-002 / SC-005)

- Index `bookmarks.created_at` for ordered listing.
- Index `tags.name` (unique) for tag lookups/filtering.
- Index the `bookmark_tags` foreign keys for join performance.
