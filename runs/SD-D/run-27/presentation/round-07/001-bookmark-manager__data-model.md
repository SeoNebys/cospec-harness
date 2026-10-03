# Phase 1 Data Model: Bookmark Manager

Storage: SQLite. Text search via FTS5. Preserved files on disk, referenced by path.
All timestamps are epoch milliseconds unless noted.

## Entities

### Bookmark
Represents one saved link.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| url | text, required | Original address, stored verbatim |
| url_key | text, required, **unique** | Canonical dedup key: lower-cased host + default port dropped; path/query/fragment preserved (see urlNormalize) |
| title | text | Editable; defaults to fetched title, else derived from url |
| description | text | Editable; defaults to fetched description |
| note | text | Markdown source; rendered safely on display |
| icon_url | text | Site icon (favicon) location or stored reference |
| preview_image_url | text | Preview/OG image location |
| created_at | integer, required | Original date-added (import may set from ADD_DATE) |
| updated_at | integer, required | Last modification |
| read_later | integer (0/1) | In read-later list |
| is_read | integer (0/1) | Read state, independent of read_later |
| is_archived | integer (0/1) | Archived (hidden from main list) |
| metadata_status | text | `ok` \| `partial` \| `failed` (drives retry offer) |

**Validation rules**
- `url` MUST be a well-formed http/https address (FR-002); otherwise reject.
- `url_key` MUST be unique across the collection — enforces "no second copy"
  on create, edit, and import (FR-006, FR-007).
- On create with no fetched title, `title` derives from `url` (FR-004).

**State transitions**
- read_later: false → true (mark read-later), true → false (remove / on mark read).
- is_read: false ↔ true (mark read / unread); tracked independently of read_later.
- is_archived: false → true (archive; leaves main list), true → false (restore;
  prior read_later and is_read retained). Delete removes the row entirely.

### Tag
A unique label grouping bookmarks.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| name | text, required, **unique (case-insensitive)** | Enforced via unique index on `lower(name)` |

**Validation rules**
- Tag `name` is unique within the collection, compared case-insensitively
  (FR-010a). Adding an existing name reuses the existing tag; never creates a second.

### BookmarkTag (join)
Many-to-many between Bookmark and Tag.

| Field | Type | Notes |
|-------|------|-------|
| bookmark_id | integer FK → Bookmark.id | on delete cascade |
| tag_id | integer FK → Tag.id | on delete cascade |
| PRIMARY KEY (bookmark_id, tag_id) | | prevents duplicate assignment |

### SavedSearch
A reusable named query with included/excluded tags.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| name | text, required | |
| query | text | Search expression string |
| include_tags | text (JSON array of tag names) | Tags that must be present |
| exclude_tags | text (JSON array of tag names) | Tags that must be absent |
| created_at | integer | |

**Validation rules**: `query` must be a parseable search expression (or empty).
Rename/delete supported (FR-025).

### PreservedCopy
A stored local rendition and/or Internet Archive reference for a bookmark.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK | |
| bookmark_id | integer FK → Bookmark.id | on delete cascade |
| kind | text | `html` (self-contained page) \| `pdf` |
| file_path | text | Path under /work/data/preserved/... |
| created_at | integer | |
| archive_org_url | text | Internet Archive snapshot reference (nullable) |
| archive_org_status | text | `ok` \| `pending` \| `failed` (nullable) |

**Validation rules**: Web pages → `kind=html` (self-contained single file, not a
readable extract); PDF destinations → `kind=pdf` (FR-029, FR-030). Internet Archive
fields populated only when that preservation is requested (FR-031); failures leave
the bookmark unaffected (FR-032).

### Preferences (single row)
Per-user display settings.

| Field | Type | Notes |
|-------|------|-------|
| id | integer PK (always 1) | Singleton |
| default_sort | text | `date_added` \| `title` \| `last_updated` |
| items_per_page | integer | e.g., 25/50/100 |
| text_size | text | `small` \| `medium` \| `large` |

**Validation rules**: values constrained to the allowed sets; persist across
sessions (FR-033).

## Full-text search index

- FTS5 virtual table `bookmark_fts(title, description, note, url)` kept in sync
  with Bookmark via triggers. Enables case-insensitive matching for the search
  leaves (FR-011). `#tag` leaves resolve via BookmarkTag/Tag rather than FTS.

## Relationships (summary)

- Bookmark 1—* PreservedCopy
- Bookmark *—* Tag (via BookmarkTag)
- SavedSearch references Tag names (include/exclude) by value
- Preferences is a singleton, independent of other entities
