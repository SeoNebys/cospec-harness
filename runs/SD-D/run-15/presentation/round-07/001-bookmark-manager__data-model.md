# Phase 1 Data Model: Bookmark Manager

Storage: SQLite (`data/bookmarks.db`). Timestamps are ISO-8601 text (UTC). Booleans are
stored as integers 0/1. Large saved-copy blobs live on the filesystem under
`data/snapshots/`; the DB stores their relative paths. Traceability to spec entities and
functional requirements (FR-xxx) is noted per table.

## Entity: Bookmark  *(spec: "Bookmark")*

One saved web reference.

| Field           | Type    | Notes / Rules                                                        |
|-----------------|---------|----------------------------------------------------------------------|
| id              | integer | Primary key.                                                         |
| url             | text    | Normalized web address; **unique** (identity key). FR-004, FR-005.   |
| title           | text    | Auto-captured, user-editable; falls back to host/URL. FR-002/003/006.|
| description     | text    | Auto-captured, user-editable. FR-002/003.                            |
| note            | text    | Markdown source (bold/italics/lists/links). FR-014; searched FR-017. |
| icon_url        | text    | Site icon location (or stored icon path). FR-002, FR-007.            |
| preview_image   | text    | Preview/OpenGraph image location. FR-002.                            |
| is_read         | integer | 0 = unread (default on create), 1 = read. FR-021/022.                |
| is_archived     | integer | 0 = active (default), 1 = archived. FR-023/024.                      |
| date_added      | text    | Set at creation; preserved on import. FR-035, FR-027, FR-034.        |
| date_modified   | text    | Updated on any edit. FR-035.                                         |

**Validation / rules**
- `url` must be a well-formed http(s) address; a missing scheme is normalized to `https://`
  before storage (FR-004). Uniqueness enforced by a DB constraint; an attempt to insert an
  existing `url` resolves to "open existing for editing" (FR-005) and import-skip (FR-034).
- New bookmarks default `is_read = 0`, `is_archived = 0`.
- Archived bookmarks are excluded from normal list and search results and included only in
  the archive view (FR-024).

## Entity: Tag  *(spec: "Tag")*

A short user-defined label. Many-to-many with bookmarks.

| Field | Type    | Notes / Rules                                    |
|-------|---------|--------------------------------------------------|
| id    | integer | Primary key.                                     |
| name  | text    | **Unique**, case-insensitive; trimmed, non-empty.|

### Join: bookmark_tags

| Field       | Type    | Notes                                             |
|-------------|---------|---------------------------------------------------|
| bookmark_id | integer | FK → bookmarks.id, on delete cascade.             |
| tag_id      | integer | FK → tags.id, on delete cascade.                  |

Primary key = (bookmark_id, tag_id). Powers tag assignment (FR-011), suggestions (FR-012),
filtering (FR-013), `#tag` search (FR-018), and bulk tag add/remove (FR-025). A tag with no
remaining bookmarks may be pruned; suggestions (FR-012) are drawn from existing tag names.

## Entity: SavedCopy  *(spec: "Saved Copy")*

A preserved version of a bookmarked page. A bookmark may have more than one (e.g. a local
snapshot **and** an Internet Archive reference).

| Field       | Type    | Notes / Rules                                                    |
|-------------|---------|-----------------------------------------------------------------|
| id          | integer | Primary key.                                                    |
| bookmark_id | integer | FK → bookmarks.id, on delete cascade.                           |
| kind        | text    | `html_snapshot` \| `pdf` \| `internet_archive`. FR-030/031/032. |
| location    | text    | Relative file path under `data/snapshots/` (html/pdf), or the archived URL (internet_archive). |
| created_at  | text    | When the copy was made.                                         |

**Rules**: `html_snapshot` = self-contained inlined HTML file (FR-030); `pdf` = the stored
PDF file when the address is a PDF (FR-031); `internet_archive` = external archived URL, only
present on successful preservation (FR-032). Failure to create any copy leaves the bookmark
and its other copies intact.

## Entity: SavedSearch  *(spec: "Saved Search")*

A stored, rerunnable query.

| Field          | Type    | Notes / Rules                                             |
|----------------|---------|-----------------------------------------------------------|
| id             | integer | Primary key.                                              |
| name           | text    | User-visible label.                                       |
| query_text     | text    | Free-text portion of the query. FR-028.                   |
| included_tags  | text    | JSON array of tag names that must be present. FR-028.     |
| excluded_tags  | text    | JSON array of tag names that must be absent. FR-028.      |
| created_at     | text    | Creation timestamp.                                       |

Running a saved search evaluates `query_text` through the search engine (contracts/
search-query.md), then applies the included/excluded tag constraints (FR-028).

## Entity: Preferences  *(spec: "Preferences")*  — single row

Display settings for the one user (FR-029).

| Field           | Type    | Notes / Rules                                                     |
|-----------------|---------|------------------------------------------------------------------|
| id              | integer | Fixed to 1 (single-row table).                                   |
| default_sort    | text    | `date_added_desc` (default) \| `date_added_asc` \| `title_asc` \| `title_desc`. FR-027/029. |
| page_size       | integer | Number of items shown per page/view. FR-029.                     |
| text_size       | text    | `small` \| `medium` (default) \| `large`. FR-029.                |

Persisted across reloads (FR-029); seeded with defaults on first run.

## Relationships (summary)

```text
Bookmark 1───* SavedCopy
Bookmark *───* Tag         (via bookmark_tags)
SavedSearch  references Tag names (included/excluded) + free text
Preferences  singleton
```

## Derived views (not tables)

- **All / active list**: bookmarks where `is_archived = 0`, ordered by the active sort
  (default `date_added_desc`). FR-007, FR-027.
- **Unread view**: active bookmarks where `is_read = 0`. FR-022.
- **Archive view**: bookmarks where `is_archived = 1`. FR-024.
- **Search/filter results**: active bookmarks matching a parsed query and/or tag filter,
  excluding archived. FR-013, FR-017–020.

## State transitions

- **Read status**: unread ⇄ read (FR-021); toggled individually or in bulk (FR-025).
- **Archive status**: active → archived (hide from normal views) → restored → active
  (reversible, FR-023/024); distinct from permanent delete (FR-016), which removes the row
  and cascades to tags-join and saved copies.
