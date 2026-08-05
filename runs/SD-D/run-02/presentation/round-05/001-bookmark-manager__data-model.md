# Phase 1 Data Model: Bookmark Manager

Derived from the spec's Key Entities and Functional Requirements. Storage: SQLite; snapshot
payloads (readable HTML/assets, original PDFs) live on the filesystem, referenced by path.

## Entities

### Bookmark
The core saved reference to a web resource.

| Field | Type | Notes |
|-------|------|-------|
| id | id | Primary key |
| url | text | The saved web address (http/https). Validated & normalized (FR-005) |
| normalized_url | text | Canonical form used for duplicate detection (FR-006); unique |
| title | text | Fetched or user-edited; fallback derived from URL when fetch fails (FR-002/004) |
| description | text | Short description, fetched or edited (FR-002/019) |
| notes | rich text | User's personal notes with basic formatting, stored portably (FR-020) |
| icon_ref | text? | Reference to stored site icon, if any |
| preview_ref | text? | Reference to stored preview image, if any |
| read_state | enum | `to_read` \| `read` (FR-022) |
| archived | boolean | Excluded from main list/searches when true (FR-024) |
| created_at | datetime | When saved; default sort key (FR-008/011) |
| updated_at | datetime | Last edit |

**Validation / rules**:
- `url` must be a well-formed http/https address; scheme-less input is normalized before save
  (FR-005).
- `normalized_url` is unique; an attempt to save an existing one resolves to the existing
  bookmark rather than inserting (FR-006).
- Archived bookmarks are excluded from the default list, default searches, and the read-later
  view (FR-016/024).

### Tag
A user-defined label; many-to-many with Bookmark.

| Field | Type | Notes |
|-------|------|-------|
| id | id | Primary key |
| name | text | Unique (case-insensitive); powers reuse suggestions (FR-018) |

`bookmark_tags` join table links Bookmark ↔ Tag.

### Snapshot
A stored copy of the linked content at save time (FR-026/027).

| Field | Type | Notes |
|-------|------|-------|
| id | id | Primary key |
| bookmark_id | id | Owning bookmark (1:1) |
| kind | enum | `readable_page` \| `pdf` |
| status | enum | `available` \| `unavailable` |
| stored_path | text? | Path in the snapshot store (null when unavailable) |
| captured_at | datetime | When the snapshot was taken |
| archive_url | text? | Public web-archive URL if opt-in submission succeeded (FR-027a) |

### SavedSearch
A named, reusable search (FR-033).

| Field | Type | Notes |
|-------|------|-------|
| id | id | Primary key |
| name | text | Display name |
| query | text | The search expression (terms, tags, conditions) |
| created_at | datetime | |

### Preferences
Single-row user settings, remembered across sessions (FR-034).

| Field | Type | Notes |
|-------|------|-------|
| default_sort | enum | `newest` \| `oldest` \| `title` (default `newest`) |
| text_size | enum | e.g. `normal` \| `large` (readability) |
| archive_optin | boolean | Whether to also submit to a public web archive (FR-027a) |

## Full-text search index

An FTS5 virtual table mirrors each bookmark's searchable text — title, url, description, notes,
and its tag names — enabling case-insensitive matching across all of them (FR-013) and the
AND / OR / NOT / grouped / exact-phrase semantics (FR-015). Typed tag terms in the search box map
to tag-scoped query clauses (FR-014).

## State transitions

- **read_state**: `to_read` ⇄ `read` (via single or bulk action; FR-022/023/029).
- **archived**: `false` → `true` (archive) and back (unarchive); never implies delete (FR-024/025).
- **delete**: permanent removal of a Bookmark and its Snapshot/tags links, after confirmation
  (FR-021) — distinct from archive.

## Relationships

- Bookmark 1 ── 1 Snapshot
- Bookmark N ── N Tag (via `bookmark_tags`)
- SavedSearch and Preferences are independent of individual bookmarks.
