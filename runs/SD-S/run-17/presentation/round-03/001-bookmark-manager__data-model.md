# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in [spec.md](./spec.md).

## Entity: Bookmark

A saved web page.

| Field         | Type              | Rules / Notes                                                        |
|---------------|-------------------|---------------------------------------------------------------------|
| id            | integer           | Primary key, auto-assigned.                                          |
| url           | string            | Required. Stored normalised (valid http/https). FR-001, FR-002/003. |
| title         | string            | Required in storage; auto-filled if user left it blank. FR-004.     |
| notes         | string            | Optional free text. FR-001.                                         |
| created_at    | timestamp (UTC)   | Set on creation, never changes. FR-014.                             |
| updated_at    | timestamp (UTC)   | Set on creation; updated on every edit. FR-008.                     |
| url_key       | string            | Normalised dedupe key (lowercased host + path). Used for FR-010.    |

**Validation rules**:
- `url` must parse as an http/https address after normalisation; otherwise the save is
  rejected with an actionable message (FR-002, SC-005).
- An address entered without a scheme is normalised to `https://…` before validation
  (FR-003).
- `title`, if blank on input, is populated by best-effort fetch, then falls back to the
  address (FR-004).
- On create, if an existing bookmark shares the same `url_key`, the API returns a
  duplicate warning and does not create a new row unless the client confirms (FR-010).

## Entity: Tag

A short label used to group and filter bookmarks.

| Field | Type    | Rules / Notes                                        |
|-------|---------|------------------------------------------------------|
| id    | integer | Primary key, auto-assigned.                          |
| name  | string  | Required, unique (case-insensitive), trimmed, short. |

## Relationship: Bookmark ↔ Tag (many-to-many)

A bookmark may carry zero or more tags; a tag may apply to many bookmarks. Modelled by
a join table `bookmark_tags (bookmark_id, tag_id)`.

- Assigning a tag that does not yet exist creates it (by name).
- A tag with no remaining bookmarks may be pruned (housekeeping; not user-visible
  behaviour required by the spec).

## Derived / query behaviour

- **List** (FR-006): all bookmarks ordered by `created_at` descending (most recent
  first), each with its tags.
- **Search** (FR-011): case-insensitive match of a term against `title`, `url`,
  `notes`, or any tag `name`.
- **Tag filter** (FR-012): bookmarks having a join row to the selected tag.
- **Empty / no-results states** (FR-013): the list endpoint reports total count so the
  UI can distinguish "nothing saved yet" from "filter matched nothing".

## Persistence notes

- SQLite schema created on first run if absent (idempotent init).
- Indexes: `url_key` (dedupe), `created_at` (ordering), `tag.name` (filter/lookup).
- Timestamps stored in UTC ISO-8601.
