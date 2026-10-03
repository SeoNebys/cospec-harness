# Phase 1 Data Model: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-24

Derived from the spec's Key Entities and Functional Requirements. Single-user v1;
no user/account entity.

## Entity: Bookmark

A saved reference to a web page.

| Field         | Type              | Rules                                                                 |
|---------------|-------------------|-----------------------------------------------------------------------|
| `id`          | integer           | System-assigned, unique, immutable. Primary key.                      |
| `url`         | string            | Required. Normalized absolute `http`/`https` URL (FR-002, FR-003).    |
| `title`       | string            | Required after defaulting. If user leaves blank, defaults to `url` (FR-003). Max 2048 chars; stored full. |
| `tags`        | list of strings   | 0..n labels. Each lowercased, trimmed, non-empty, deduplicated (FR-009). |
| `created_at`  | timestamp (UTC)   | System-set at creation. Used for default ordering, newest first (FR-005). |
| `updated_at`  | timestamp (UTC)   | System-set at creation and on every edit (FR-007).                    |

### Validation rules

- **VR-1 (url required & valid)**: `url` must be present and, after normalization,
  parse as an absolute `http`/`https` URL; otherwise reject (FR-002).
- **VR-2 (scheme normalization)**: If the submitted address has no scheme, prepend
  `https://` before validating (spec edge case).
- **VR-3 (title default)**: Empty/whitespace-only title becomes the normalized
  `url` (FR-003).
- **VR-4 (tag normalization)**: Trim each tag, lowercase it, drop empties, and
  remove duplicates within a bookmark.
- **VR-5 (safe content)**: Values are stored as-is (no HTML stripping) and always
  rendered as text, never as markup (FR-014).
- **VR-6 (duplicate detection)**: On create, if a bookmark with the same
  normalized `url` already exists, return a non-blocking warning alongside a
  successful save (FR-013).

### Storage representation

- Table `bookmarks(id, url, title, tags_json, created_at, updated_at)`.
- `tags_json` holds the normalized tag list as a JSON array of strings (v1 scale
  does not warrant a separate tag table; see Tag entity note).
- Index on `url` to support duplicate detection; ordering by `created_at DESC`.

## Entity: Tag (conceptual)

A short label grouping bookmarks. In v1 a tag has no independent record — it
exists only as a normalized string within a bookmark's `tags` list. The set of
"all tags" available for filtering is derived by collecting distinct tag values
across bookmarks (FR-010). A dedicated table is deliberately deferred until
tag rename/color/description features are requested.

## Derived views

- **Bookmark list**: all bookmarks ordered by `created_at DESC` (FR-005), after
  applying optional search term and tag filter (FR-010, FR-011), combined with
  AND. Empty result and empty collection are distinguished for messaging (FR-012).
- **Tag list**: distinct, sorted tag values across all bookmarks, for the filter
  control.

## State & lifecycle

A bookmark has a simple lifecycle: **created → (edited)\* → deleted**. There are
no status flags or workflow states in v1. Delete is permanent and confirmed in
the UI (FR-008); no soft-delete/trash in v1.
