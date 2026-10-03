# API Contract: Bookmark Manager

Single Node service on `http://0.0.0.0:4000`. JSON request/response bodies unless
noted. Errors return `{ "error": "message" }` with an appropriate 4xx/5xx status.
This contract lists behavior, not implementation.

## Bookmarks

### POST /api/bookmarks
Save a bookmark. Body: `{ url, title?, description?, tags?[] }`.
- Rejects empty/malformed `url` → 400 (FR-002).
- If `url` already exists → 200 with the existing bookmark and
  `{ "duplicate": true }` so the client opens it for editing (FR-008); no new row.
- Otherwise fetches metadata best-effort, creates the row, returns 201 with the
  bookmark (FR-001/FR-003/FR-005).

### GET /api/bookmarks
List bookmarks. Query params:
- `q` — search query (see search-grammar.md); errors on malformed query → 400
  (FR-009/FR-011).
- `include_tags` — repeatable/CSV tag names the bookmark MUST all have.
- `exclude_tags` — repeatable/CSV tag names the bookmark MUST NOT have.
  Together with `q`, these express a complete saved filter; applying a saved
  filter means passing its `terms` as `q` plus its `include_tags` and
  `exclude_tags` here, and results reflect ALL of those conditions (FR-019).
- `view` — `normal` (default, excludes archived), `unread`, or `archive`
  (FR-015/FR-016).
- `sort` — `newest` (default via prefs), `oldest`, `title`, `updated` (FR-018).
- `page`, `page_size` — pagination (FR-024 page size default from prefs).
Returns `{ items[], total }`. Each item includes title, description, tags,
icon_url (FR-004a) plus state flags and timestamps.

### GET /api/bookmarks/:id
Return one bookmark including rendered (sanitized) note HTML and raw note.

### PATCH /api/bookmarks/:id
Update any of `title, description, url, note, tags` (FR-004/FR-006/FR-013/FR-025).
`note` accepts Markdown; response includes sanitized rendered HTML. Updating to a
`url` that collides with another bookmark → 409.

### DELETE /api/bookmarks/:id
Permanently delete one bookmark (client confirms first, FR-025) → 204. Also
removes the bookmark's local page-copy file, if any (archiving does not).

### POST /api/bookmarks/bulk
Apply one action to many (FR-017). Body:
`{ ids?[] | selectAll?: { q, view, include_tags?, exclude_tags? }, action, payload? }`.
- `selectAll` targets exactly the items visible under the complete current
  filter — the same `q`, `view`, `include_tags`, and `exclude_tags` used by
  `GET /api/bookmarks` — so all include/exclude tag conditions are carried
  through, and never hidden items (FR-017).
- `action` ∈ `add_tags | remove_tags | mark_read | mark_unread | archive |
  restore | delete`. `delete` requires a single confirmation client-side.
Returns `{ affected }`.

### POST /api/bookmarks/:id/read  &  /unread
Toggle read state (FR-015). → 200 with updated bookmark.

### POST /api/bookmarks/:id/archive  &  /restore
Toggle archived state (FR-016). → 200 with updated bookmark.

### POST /api/bookmarks/:id/pagecopy
Create a self-contained local copy (FR-021). Detects PDF vs HTML. On success
stores the file and sets `page_copy_path`/`page_copy_kind` → 200. External/fetch
failure → 502 with a clear message; the bookmark is unchanged (edge case).

### GET /api/bookmarks/:id/pagecopy
Serve the preserved single-file copy (HTML or PDF) for offline-style viewing.

### POST /api/bookmarks/:id/archiveorg
Submit the URL to the Internet Archive and store the snapshot link (FR-022).
Service unreachable → 502 with a clear message; bookmark unchanged.

## Tags

### GET /api/tags?q=
List tags; with `q`, returns suggestions matching the prefix for type-ahead
(FR-014). Tag names are unique (FR-014a) — reused, never duplicated.

## Saved filters

### GET /api/filters  ·  POST /api/filters  ·  DELETE /api/filters/:id
Create, list, and delete named filters composed of `terms`, `include_tags`,
`exclude_tags` (FR-019). Applying a filter is done by the client passing its
`terms` as `q` plus its `include_tags` and `exclude_tags` to
`GET /api/bookmarks` (and to `bulk` `selectAll`), so every include/exclude
condition is honored.

## Preferences

### GET /api/preferences  ·  PATCH /api/preferences
Read and update `default_sort`, `page_size`, `text_size`; persisted (FR-024).

## Import / export

### POST /api/import
Accept an uploaded Netscape bookmark HTML file. Creates bookmarks preserving
titles, tags, and dates; merges by URL rather than duplicating (FR-020).
Malformed/non-bookmark file → 400, nothing imported. Returns
`{ imported, merged }`.

### GET /api/export
Return a Netscape bookmark HTML file (attachment) with titles, tags, and dates
preserved (FR-020, SC-006).

## UI

### GET /
Server-rendered app shell. The primary element is marked
`data-harness-ready="true"` once initial UI and data have loaded (including a
valid empty state). Views: normal list, unread, archive, plus editing, search,
bulk selection, filters, preferences, and import/export controls.
