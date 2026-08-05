# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and Functional Requirements. Single-user
scope → no owner/account entity.

## Entity: Bookmark

A saved reference to a web page.

| Field         | Type                | Notes / Rules |
|---------------|---------------------|---------------|
| `id`          | string (UUID)       | Primary key, server-generated |
| `url`         | string              | Required; must be a well-formed `http`/`https` URL (FR-002) |
| `normalizedUrl` | string            | Derived from `url` for duplicate detection (FR-015); lower-cased scheme+host, trailing slash trimmed |
| `title`       | string              | Required in storage; user-provided or auto-derived; falls back to `url` (FR-003, FR-004) |
| `description` | string (optional)   | Free-text notes |
| `tags`        | string[]            | Zero or more tag names (FR-009); normalized (trimmed, lower-cased, de-duplicated) |
| `createdAt`   | timestamp (ISO 8601)| Set on save; supports "most recently saved" ordering (FR-016) |
| `updatedAt`   | timestamp (ISO 8601)| Updated on edit (FR-012) |
| `deletedAt`   | timestamp \| null   | Soft-delete marker for the undo window (FR-013, FR-014); null = active |

**Validation rules**
- `url` must parse as an absolute `http`/`https` URL; otherwise reject (FR-002).
- `title` is non-empty after derivation/fallback.
- `tags`: each tag non-empty after trimming; the list de-duplicated after normalization.
- A save whose `normalizedUrl` matches an existing active bookmark triggers the
  duplicate-warning flow rather than silent insert (FR-015).

**State transitions**
- `active` → (delete) → `pending-deletion` (`deletedAt` set) → (undo) → `active`
- `pending-deletion` → (undo window elapses / purge) → removed permanently

## Entity: Tag

A short user-defined label for categorizing and filtering.

| Field    | Type   | Notes / Rules |
|----------|--------|---------------|
| `name`   | string | Normalized (trimmed, lower-cased); unique |
| `count`  | number | Derived: number of active bookmarks carrying the tag (for filter UI) |

**Notes**
- Tags are modeled by their use on bookmarks (a distinct list derived from active
  bookmarks' `tags`). No separate lifecycle beyond appearing/disappearing as
  bookmarks reference them. A dedicated `tag` table with a join is an acceptable
  implementation detail deferred to tasks; the contract exposes tags as strings.

## Relationships

- Bookmark *has many* Tags; a Tag *applies to many* Bookmarks (many-to-many by name).

## Indexing (for SC-002 / SC-005)

- Index on `normalizedUrl` (dedupe lookups).
- Index on `createdAt` (recent-first ordering).
- Index supporting case-insensitive search over `title`/`url`; tag lookup indexed
  via whatever tag storage the implementation chooses.
- Queries filter out `deletedAt IS NOT NULL` by default.
