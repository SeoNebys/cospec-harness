# Phase 1 Data Model: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16

Derived from the Key Entities and Functional Requirements in
[spec.md](./spec.md). Persistence is SQLite (see [research.md](./research.md)).

## Entities

### Bookmark

A saved web link.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key, auto-assigned. |
| `url` | string | Required. Well-formed `http`/`https` address (FR-002). Stored in normalized form. Unique — no silent duplicates (FR-009). |
| `title` | string | Required in storage. If the user supplies a custom title it is used; otherwise derived from the fetched page title, else the `url` (FR-003). Trimmed; non-empty. |
| `created_at` | timestamp | Set when the bookmark is first saved. Drives default most-recent-first ordering (FR-014). |
| `updated_at` | timestamp | Set on creation and on every edit (FR-007). |

Relationships: a Bookmark has zero or more Tags (many-to-many via BookmarkTag).

### Tag

A short label used to group bookmarks.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key, auto-assigned. |
| `name` | string | Required. Trimmed, lowercased for storage/matching, non-empty, unique. Reasonable max length (e.g. 50 chars). |

Relationships: a Tag applies to zero or more Bookmarks (many-to-many).

### BookmarkTag (association)

Join between Bookmark and Tag.

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | integer | References Bookmark. Deleting a bookmark removes its associations. |
| `tag_id` | integer | References Tag. |

Composite uniqueness on (`bookmark_id`, `tag_id`) — a tag applies to a bookmark
at most once.

## Validation rules (from requirements)

- **URL well-formedness** (FR-002): reject anything the WHATWG URL parser cannot
  parse, or whose scheme is not `http`/`https`, with a clear message.
- **URL normalization** (supports FR-009): lowercase scheme and host, remove
  default ports, collapse an empty path to `/`, before storing and before
  duplicate comparison.
- **Duplicate detection** (FR-009): a save whose normalized `url` matches an
  existing bookmark is rejected with an "already exists" warning; no new row.
- **Title fallback** (FR-003): empty/whitespace custom title → use fetched page
  title → if unavailable, use the `url`.
- **Tag normalization** (FR-010): trim and lowercase tag names; deduplicate
  within a single bookmark; reuse an existing Tag row when the name matches.

## Lifecycle / state

Bookmarks have no workflow states beyond existence. Transitions:

- **Create**: validate + normalize URL → check duplicate → resolve title →
  insert Bookmark → upsert Tags → link (sets `created_at`, `updated_at`).
- **Edit** (FR-007): validate + normalize URL (duplicate check excludes self) →
  update fields and tag set → refresh `updated_at`.
- **Delete** (FR-008): remove the Bookmark and its BookmarkTag associations after
  explicit confirmation. Tags left with no bookmarks may be pruned (optional).

## Derived views

- **List** (FR-005, FR-014): all bookmarks with their tags, ordered by
  `created_at` descending by default.
- **Filter by tag** (FR-011): bookmarks linked to the selected tag(s).
- **Keyword search** (FR-012): bookmarks whose `title`, `url`, or any tag `name`
  contains the query (case-insensitive substring).
- **Empty / no-results states** (FR-013): the list view distinguishes "no
  bookmarks saved yet" from "no matches for this filter/search".
