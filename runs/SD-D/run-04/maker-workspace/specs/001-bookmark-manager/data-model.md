# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in `spec.md`. Storage is
SQLite; this document is technology-light where possible but names the concrete
tables/columns the implementation will use.

## Entities

### Bookmark

A saved reference to a web page (spec: "Bookmark").

| Field            | Type      | Notes / Source |
|------------------|-----------|----------------|
| `id`             | integer   | Primary key |
| `url`            | text      | The address as saved/normalized-displayable (FR-001) |
| `url_key`        | text      | Normalized canonical form; **UNIQUE**; duplicate key (FR-023, SC-007, research §6) |
| `title`          | text      | Person-provided or default from page/address (FR-004) |
| `description`    | text      | Auto-fetched, person-editable (FR-005/FR-006); may be empty |
| `notes`          | text      | Markdown subset: headings, bullets, links (FR-003) |
| `icon_url`       | text      | Site icon location; best-effort, may be null (FR-005) |
| `image_url`      | text      | Preview image location; best-effort, may be null (FR-005) |
| `read_later`     | integer   | 0/1 flag (FR-015) |
| `archived`       | integer   | 0/1 flag (FR-016) |
| `enrich_status`  | text      | `pending` \| `done` \| `failed` — background metadata fetch state (research §3) |
| `created_at`     | text      | ISO timestamp; saved date (FR-025), default sort key (FR-014) |
| `updated_at`     | text      | ISO timestamp; last-modified date (FR-025) |

**Validation rules**:
- `url` must be a well-formed http/https address after normalization; malformed
  input is rejected with a message and nothing is saved (FR-002).
- `url_key` uniqueness is enforced by the database; an attempted duplicate resolves
  to "return the existing bookmark" rather than inserting (FR-023).
- `title` is never empty at rest: if the person supplies none and no page title is
  obtained, it defaults to the address (FR-004).

**State & lifecycle**:
- `enrich_status`: `pending` on create → `done` (metadata applied) or `failed`
  (fetch timed out/unreachable; card shows what little exists) (research §3).
- `archived`: `false` (in main list & default search) ⇄ `true` (only in archived
  view) via archive/restore (FR-016). Archived items are excluded from the main list
  and default/search results (Assumptions, edge case "archived items in search").
- `read_later`: toggled independently of archived (FR-015).
- Deletion is permanent and removes the row after confirmation (FR-017).

### Tag

A short label applied to bookmarks (spec: "Tag").

| Field   | Type    | Notes |
|---------|---------|-------|
| `id`    | integer | Primary key |
| `name`  | text    | **UNIQUE**, stored lowercased for case-insensitive matching & suggestions (FR-012) |

- Many-to-many with Bookmark via `bookmark_tags(bookmark_id, tag_id)`.
- A bookmark may carry several tags; a tag may apply to many bookmarks.
- Distinct tag names + usage counts drive suggestions (FR-012) and the tag filter UI.

### SavedSearch

A named, reusable filter definition (spec: "Saved Search").

| Field        | Type    | Notes |
|--------------|---------|-------|
| `id`         | integer | Primary key |
| `name`       | text    | Person-supplied label; renameable (FR-021) |
| `query_text` | text    | Free-text/quoted-phrase portion of the filter |
| `filter`     | text    | Serialized `TagFilter` (any/all/not) — see `contracts/filter-model.md` |
| `created_at` | text    | ISO timestamp |

- Stores the **filter definition, not results** — re-runs live against the current
  collection when applied (FR-021, Story 5, edge case "saved search returns nothing later").

### Export File (transient, not a stored table)

A portable JSON document (spec: "Export File") produced by export and consumed by
import (FR-026..FR-030). It is not persisted in the database; it is generated on
demand and read on import. Shape is defined in `contracts/rest-api.md`
(`GET /api/export`). It captures every Bookmark (with tags and state) and every
SavedSearch — enough to fully restore the collection (SC-008). Import merges by
`url_key` and applies atomically (research: single transaction) so a bad file never
corrupts the existing collection (FR-030).

## Relationships

```text
Bookmark 1 ──< bookmark_tags >── 1 Tag        (many-to-many)
SavedSearch (standalone; references tags by name inside its serialized filter)
```

## Search index

- An FTS5 virtual table indexes `title`, `url`, `description`, `notes`, and the
  bookmark's concatenated tag names, kept in sync via triggers on write.
- Used for text and quoted-phrase search (FR-009/FR-010); tag boolean logic
  (FR-011) is applied as a join/filter alongside the FTS match. See
  `contracts/filter-model.md` for evaluation order and semantics.

## Derived views (query-level, not stored tables)

- **Main list**: `archived = 0`, ordered by chosen sort (FR-014), default newest-first.
- **Read-later view**: `archived = 0 AND read_later = 1` (FR-015).
- **Archived view**: `archived = 1` (FR-016).
- Each view has its own empty / no-results state (FR-024).
