# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in [spec.md](./spec.md).

## Entity: Bookmark

A saved web link and its details.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | identifier | yes | Unique, system-generated |
| `url` | text | yes | The web address as entered (FR-001) |
| `normalized_url` | text | yes | Derived key for duplicate detection (research §5); indexed |
| `title` | text | no | Auto-fetched by default; user edit takes precedence (FR-001, FR-014, FR-015). Empty ⇒ display fallback to `url` (FR-003) |
| `note` | text | no | Free-text user note (FR-001) |
| `preview_description` | text | no | Short snippet from page metadata (FR-014) |
| `preview_image_url` | text | no | Thumbnail address from page metadata, when available (FR-014) |
| `fetch_status` | enum | yes | `pending` \| `success` \| `failed` — drives async-enrichment UI (FR-016, FR-017) |
| `created_at` | timestamp | yes | Set on save; used for newest-first ordering (FR-005, FR-013) |
| `updated_at` | timestamp | yes | Updated on edit or enrichment |

**Validation rules**:
- `url` MUST be a well-formed web address (http/https) or the save is rejected (FR-002).
- `normalized_url` is computed from `url` on create; a matching existing `normalized_url` triggers the duplicate warning (FR-012) — warning, not a hard block.
- `title` may be blank; display layer substitutes `url` (FR-003).

**State (`fetch_status`) transitions**:
- On save: `pending` (unless the user typed a title and enrichment is not attempted, in which case it may be recorded as `success`/`n/a` — implementation detail).
- Enrichment succeeds → `success` (title/preview populated unless user already set title).
- Enrichment fails or times out → `failed` (fallback label used; user may edit title). (FR-016, FR-017)

## Entity: Tag

A short label for grouping bookmarks by topic.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | identifier | yes | Unique, system-generated |
| `name` | text | yes | Normalized (trimmed, case-insensitive-unique) (research §6) |

**Validation rules**:
- `name` MUST be non-empty after trimming.
- `name` is unique case-insensitively ("Work" == "work").

## Relationship: Bookmark ↔ Tag

- Many-to-many: a bookmark may carry many tags; a tag may apply to many bookmarks (spec Key Entities).
- Represented by a join between bookmarks and tags.
- Adding/removing a tag on one bookmark does not affect the same tag on other bookmarks (edge case: "Deleting a tag in use").
- Filtering by a tag returns exactly the bookmarks joined to it (FR-009).

## Search index

- A full-text index over `title`, `url`, and `note` supports term search returning only matching bookmarks (FR-006), kept in sync with the Bookmark table.
- Results ordered newest-first by `created_at` unless a search relevance ordering is preferred; empty result set drives the "no results" state (FR-007).

## Derived / display rules

- **Display label** = `title` if present, else `url` (FR-003).
- **Ordering** default = `created_at` descending (FR-005).
- **Empty collection** (no bookmarks) drives the empty-state view (FR-007).
