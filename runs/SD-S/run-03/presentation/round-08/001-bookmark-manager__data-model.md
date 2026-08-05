# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and Functional Requirements. Describes the
logical model; storage is a single local SQLite database (see research.md).

## Entity: Bookmark

A saved reference to a web page.

| Field       | Type                     | Rules                                                                 | Source |
|-------------|--------------------------|-----------------------------------------------------------------------|--------|
| `id`        | integer, auto-assigned   | Unique, system-generated.                                             | —      |
| `url`       | text                     | Required. Must be a well-formed `http`/`https` URL (FR-002).          | FR-001 |
| `title`     | text                     | Required for display. Auto-fetched if blank; falls back to `url` (FR-003). | FR-003/FR-004 |
| `note`      | text                     | Optional free text. May be empty.                                     | FR-010 |
| `created_at`| timestamp                | Required. Set at creation; used for "newest first" ordering (FR-014). | FR-014 |
| `url_key`   | text (derived, indexed)  | Normalised URL used for duplicate detection (FR-013). Not user-visible. | FR-013 |

**Relationships**: A Bookmark has zero or more Tags (many-to-many via Tag).

**Validation rules**:
- Reject save if `url` is missing or not a valid http(s) URL → clear error, nothing saved (FR-002).
- If `title` is blank after any auto-fetch attempt, set it to the `url` (FR-003).
- On create, if `url_key` matches an existing bookmark, return a duplicate warning; do not silently create a second copy (FR-013). The user may confirm to keep it.

## Entity: Tag

A short user-defined label for grouping bookmarks.

| Field   | Type                   | Rules                                             | Source |
|---------|------------------------|---------------------------------------------------|--------|
| `id`    | integer, auto-assigned | Unique, system-generated.                         | —      |
| `name`  | text                   | Required, non-empty, unique (case-insensitive), trimmed. | FR-009 |

**Relationships**: A Tag applies to many Bookmarks; a Bookmark may carry many Tags.

**Validation rules**:
- Blank/whitespace-only tag names are rejected.
- Tag names are matched case-insensitively so "News" and "news" are the same tag.
- Removing a tag from one bookmark does not affect other bookmarks that use it (Edge Case: "Deleting a tag in use").

## Relationship: Bookmark ↔ Tag

A join between bookmarks and tags (many-to-many). Deleting a bookmark removes its
tag associations but not the tags themselves; a tag with no remaining
associations may be pruned or simply left unused (implementation detail, not
user-visible).

## Derived / query concerns (from Success Criteria)

- **Search** matches a text term against `title`, `url`, `note`, and associated
  tag names (FR-008). Backed by indexes so results return within 1s at 1,000
  bookmarks (SC-003).
- **Tag filter** returns bookmarks associated with a given tag (FR-009).
- **Ordering** defaults to newest-first by `created_at` (FR-014).

## Lifecycle

Bookmarks: created (FR-001) → optionally edited (FR-011) → deleted with
confirmation (FR-012). No soft-delete/archival in v1. There are no other state
transitions.
