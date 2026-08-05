# Phase 1 Data Model: Bookmark Manager

Storage: a single local SQLite database file. Two entities plus a link table for
the many-to-many relationship between bookmarks and tags.

## Entity: Bookmark

A saved reference to a web page.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer | Primary key, auto-assigned. |
| `url` | text | The web page address. Required, well-formed `http`/`https` (FR-002). |
| `url_normalized` | text | Normalized address (trimmed, scheme/host lower-cased) used for duplicate detection. UNIQUE among non-deleted bookmarks (FR-014). |
| `title` | text | Human-readable title. Auto-derived when not supplied (FR-003); never empty. |
| `description` | text | Optional free-text notes. May be empty. |
| `created_at` | timestamp | When the bookmark was saved (FR-004). Set once. |
| `updated_at` | timestamp | When the bookmark was last modified. |
| `deleted_at` | timestamp \| null | Set when soft-deleted; enables undo (FR-013). Null = active. |

**Validation rules**

- `url` MUST parse as an absolute `http`/`https` URL; otherwise the save is
  rejected with an explanatory message (FR-002).
- `title` MUST be non-empty after save; if the user supplies none and no page
  title can be retrieved, `title` falls back to `url` (FR-003).
- `url_normalized` MUST be unique across active (non-deleted) bookmarks. A save
  colliding with an active bookmark is surfaced as a duplicate warning, not an
  error (FR-014).

**Lifecycle**

`active` → (delete + confirm) → `soft-deleted` (`deleted_at` set) → (undo) →
`active`. A soft-deleted bookmark is excluded from all lists, searches, and
filters. (Whether/when soft-deleted rows are purged is an implementation detail
for tasks; not user-facing in v1.)

## Entity: Tag

A short label used to group bookmarks.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer | Primary key, auto-assigned. |
| `name` | text | Label text. Required, non-empty, UNIQUE (case-insensitive). |

**Validation rules**

- `name` MUST be non-empty and trimmed.
- Tag names are unique case-insensitively (`Work` and `work` are the same tag).
- Renaming a tag updates it for every bookmark that carries it (FR-009).
- Removing a tag removes it from every bookmark that carries it (FR-009).

## Relationship: Bookmark ↔ Tag (many-to-many)

A link table `bookmark_tags` associates bookmarks with tags.

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer | References `Bookmark.id`. |
| `tag_id` | integer | References `Tag.id`. |

- A bookmark may carry many tags; a tag may apply to many bookmarks.
- The pair (`bookmark_id`, `tag_id`) is unique.
- Removing a bookmark's tag detaches the link; it does not delete the tag unless
  the tag is explicitly removed.

## Derived / query concerns

- **Search** (FR-007): match a keyword against `title`, `url`, and associated tag
  names, over active bookmarks only. Indexed to meet SC-003 (<1s at 5,000).
- **Tag filter** (FR-010): list active bookmarks carrying a selected tag.
- **List** (FR-006): active bookmarks with title, url, tags, and `created_at`,
  most-recent first by default.
