# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and functional requirements. Storage: local SQLite.

## Entity: Bookmark

Represents one saved link.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer | Primary key. |
| `url` | text | The full web address as entered. Required. Must be a well-formed http/https URL (FR-003). |
| `url_normalized` | text | Normalized form used for uniqueness (FR-004, research §8). **Unique.** |
| `title` | text | Page title; falls back to `url` when none captured (FR-002). Required (non-empty). |
| `favicon` | blob (nullable) | Site icon bytes captured at save (FR-002a); null if unavailable. |
| `favicon_mime` | text (nullable) | MIME type of stored favicon. |
| `note_html` | text (nullable) | Sanitized rich-text note/description — links, bold, bullet lists (FR-015). |
| `note_text` | text (nullable) | Plain-text extraction of the note, maintained for search. |
| `date_saved` | datetime | When saved; may originate from an import's `ADD_DATE` (FR-014, FR-016b). Required. |
| `date_modified` | datetime | Last edit time. Required. |

**Relationships**: many-to-many with Tag via `bookmark_tag`.

**Validation rules**:
- `url` rejected if not a well-formed http/https address (FR-003).
- `url_normalized` uniqueness enforces no duplicates; a save colliding here resolves to the
  existing bookmark's edit flow rather than an insert (FR-004).
- `note_html` sanitized to the allowlist before persist (FR-015); `note_text` derived from it.
- `title` never stored empty — defaults to `url`.

## Entity: Tag

A short text label grouping bookmarks.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | integer | Primary key. |
| `name` | text | Tag label. **Unique** (case-insensitive). Required, non-empty, trimmed. |

**Relationships**: many-to-many with Bookmark.

**Validation / behavior**:
- Names compared case-insensitively so "recipe" and "Recipe" are one tag (supports the
  suggestion feature, FR-010a).
- A tag with no remaining bookmarks stops appearing in filters (spec edge case); it may be
  garbage-collected or simply left orphaned — orphan cleanup is an implementation detail.

## Join: bookmark_tag

| Field | Type | Notes |
|-------|------|-------|
| `bookmark_id` | integer | FK → Bookmark.id, cascade delete. |
| `tag_id` | integer | FK → Tag.id. |

Composite primary key (`bookmark_id`, `tag_id`).

## Search index: bookmarks_fts (SQLite FTS5)

A full-text virtual table over a synthesized document per bookmark:
`title` + `url` + `note_text` + concatenated tag names. Enables case-insensitive keyword
search across all four (FR-012). Kept in sync with Bookmark/tag changes via triggers or
service-layer updates.

## Derived / computed views

- **List ordering**: `date_saved DESC` (default) or `title COLLATE NOCASE ASC` (FR-014).
- **Tag filter**: bookmarks joined to a given tag (FR-011).
- **Tag suggestions**: existing tag names matching a typed prefix, case-insensitive (FR-010a).

## State & lifecycle

Bookmarks have no workflow states — they exist from save until delete. Delete is a hard
delete after user confirmation (FR-009); cascades remove `bookmark_tag` rows.

## Traceability

| Requirement | Model support |
|-------------|---------------|
| FR-001, FR-005 | Bookmark row persisted in SQLite |
| FR-002 / FR-002a/b | title fallback; favicon + note fields |
| FR-003 | url validation rule |
| FR-004 | url_normalized unique + edit-redirect |
| FR-010 / FR-010a | Tag + bookmark_tag; case-insensitive name |
| FR-011 / FR-012 | tag join; bookmarks_fts |
| FR-014 | date_saved + title ordering |
| FR-015 | note_html (sanitized) + note_text |
| FR-016a/b | folder→tag mapping; date_saved from ADD_DATE |
