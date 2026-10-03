# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and Functional Requirements. Persistence is
a local SQLite database; the logical model below is storage-agnostic.

## Entity: Bookmark

A saved reference to a web page.

| Field         | Type              | Notes / Rules |
|---------------|-------------------|---------------|
| `id`          | integer (PK)      | Server-assigned identifier. |
| `url`         | string            | Required. Must be a well-formed `http`/`https` URL (FR-002). Stored as entered. |
| `normalized_url` | string         | Derived from `url` for duplicate detection (FR-009). Unique across bookmarks. |
| `title`       | string            | Display title. Auto-filled from page, user-entered, or derived from URL (FR-003, FR-007). |
| `description` | string (nullable) | Auto-filled from page metadata; user-editable (FR-007, FR-012). |
| `favicon_url` | string (nullable) | Absolute URL to the site icon; best-effort (FR-007, FR-008). |
| `preview_url` | string (nullable) | Absolute URL to preview/OG image; best-effort (FR-007, FR-008). |
| `note`        | string (nullable) | User free-text note (FR-010). |
| `enrichment_status` | enum         | `pending` \| `done` \| `failed`. Reflects best-effort fetch outcome (FR-008); UI may show a subtle indicator. |
| `created_at`  | timestamp         | When the bookmark was added; drives default newest-first order (FR-017). |
| `updated_at`  | timestamp         | Last modification time. |

**Validation rules**
- `url` must parse as an absolute `http`/`https` URL, else reject with a clear
  message (FR-002); no bookmark is created.
- On create, `normalized_url` is computed; if it collides with an existing
  bookmark, the create is rejected as a duplicate and the existing `id` is
  returned so the client can route to edit (FR-009). Not a validation error.
- If `title` is empty after enrichment and user input, fall back to a
  URL-derived name (FR-003).
- Enrichment never blocks creation: a bookmark is persisted first with
  `enrichment_status = pending`; failure sets `failed`, success sets `done`
  (FR-008).

**Relationships**
- Many-to-many with **Tag** via **BookmarkTag**.

## Entity: Tag

A short, user-defined label for grouping and filtering.

| Field  | Type         | Notes / Rules |
|--------|--------------|---------------|
| `id`   | integer (PK) | Server-assigned. |
| `name` | string       | Required, non-empty after trim. Unique (case-insensitive) so tags are reused, not duplicated (FR-011). |

**Validation rules**
- Empty/whitespace-only tag names are rejected.
- Tag names are matched case-insensitively for reuse and suggestions (FR-011).

**Relationships**
- Many-to-many with **Bookmark** via **BookmarkTag**.

## Entity: BookmarkTag (association)

Join between a bookmark and a tag.

| Field         | Type         | Notes |
|---------------|--------------|-------|
| `bookmark_id` | integer (FK) | References Bookmark. Cascade-deletes with the bookmark. |
| `tag_id`      | integer (FK) | References Tag. |

- Composite uniqueness on (`bookmark_id`, `tag_id`) — a tag applies at most once
  per bookmark.
- When a bookmark is deleted, its associations are removed. Tags with no
  remaining associations may be pruned or retained for suggestions (retain for v1
  simplicity; suggestions come from existing tag names).

## Derived / query concerns

- **Search** (FR-016, SC-003): case-insensitive substring match over
  `title`, `url`, `description`, `note`, and associated tag `name`s. Combinable
  with a **tag filter** (bookmarks carrying a selected tag).
- **Default ordering** (FR-017): `created_at` descending (newest first).
- **Tag suggestions** (FR-011): distinct existing tag names, optionally filtered
  by the prefix the user is typing.

## State: enrichment lifecycle

```text
create bookmark ──► enrichment_status = pending
        │
        ├─ fetch + parse succeeds ─► fill available fields ─► status = done
        └─ fetch fails / times out / no metadata ─► leave fields empty/fallback ─► status = failed
refresh request ──► re-run the same lifecycle for an existing bookmark (FR-013)
```
