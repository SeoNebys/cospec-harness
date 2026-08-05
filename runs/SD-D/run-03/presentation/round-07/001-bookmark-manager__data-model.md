# Phase 1 Data Model: Bookmark Manager

All data is local (single SQLite file, single user). Times stored as UTC.

## Entity: Bookmark

| Field | Type | Rules / Notes |
|-------|------|---------------|
| `id` | integer, PK | Internal id. |
| `url` | text, required, **unique** | Well-formed http/https address (FR-002). Uniqueness backs "re-save opens existing" (FR-011) and import de-dupe (FR-014). Compared normalised (scheme/host lowercased, trailing-slash trimmed). |
| `title` | text, required | Auto-derived from page; falls back to `url` when unknown (FR-003). User may override (FR-004). |
| `icon` | blob/text, nullable | Cached site icon or its reference (FR-003). Best-effort. |
| `description` | text, nullable | Short page blurb, auto-captured (FR-003); user-editable (FR-004). |
| `notes` | text (Markdown), nullable | User notes with light formatting (FR-004b). |
| `date_added` | datetime, required | Save time, or the original date from an import file when present (FR-013, FR-014). Default sort key (newest first). |
| `is_read` | boolean, default false | Read-later state (FR-017). `false` = unread pile. |
| `is_archived` | boolean, default false | Archived items excluded from main list & default search (FR-016). |
| `tags` | relation → Tag (many-to-many) | See Bookmark↔Tag. |

**States**: `active/unread`, `active/read`, `archived` (archive is orthogonal to
read state; restoring clears `is_archived`, FR-016). Delete is permanent and
confirmed (FR-008); archive is the reversible alternative.

## Entity: Tag

| Field | Type | Rules / Notes |
|-------|------|---------------|
| `id` | integer, PK | |
| `name` | text, required, **unique (case-insensitive)** | Canonical form prevents "recipe"/"Recipe" duplicates (FR-004a). |

- **Bookmark ↔ Tag**: many-to-many via a join table. A tag with no remaining
  bookmarks disappears from the filter list (spec edge case) — surfaced by
  filtering the tag list to tags currently in use.
- Import folder names become tags (FR-014); nested folders → one tag per level.

## Entity: SavedSearch  *(only if FR-019 is kept — client decision at plan gate)*

| Field | Type | Rules / Notes |
|-------|------|---------------|
| `id` | integer, PK | |
| `name` | text, required, unique | E.g. "unread cooking articles". |
| `keyword` | text, nullable | Free-text part of the query. |
| `include_tags` | list of tag refs | Match-any (OR). |
| `exclude_tags` | list of tag refs | NOT. |
| `unread_only` | boolean, default false | Restrict to unread pile. |

Reapplying = feeding these values into the same filter path used by live search
(FR-019). If the client drops FR-019, this entity is removed entirely.

## Derived / query concepts (not stored)

- **Search query parse** (FR-009): quoted `"exact phrase"` vs. case-insensitive
  substring words, matched across title/url/description/notes/tag names.
- **Tag filter** (FR-010): `{include: [...], exclude: [...]}` combined with the
  keyword result via AND.
- **Sort** (FR-013): `date_added desc` (default) or `title asc` (case-insensitive).
- **Main list scope**: `is_archived = false`; archive view is `is_archived = true`.
- **Bulk target** (FR-018): either explicit `ids[]` or the current
  filter/search criteria resolved server-side.

## Validation summary (from requirements)

- URL well-formed http/https or reject (FR-002).
- URL unique → re-save routes to edit of existing (FR-011); import skips existing
  (FR-014).
- Delete requires confirmation; archive is recoverable (FR-008, FR-016, SC-005).
- Tag names canonicalised case-insensitively (FR-004a).
