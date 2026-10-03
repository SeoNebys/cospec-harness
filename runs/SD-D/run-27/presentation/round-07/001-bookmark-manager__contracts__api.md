# Phase 1 API Contract: Bookmark Manager

JSON over HTTP under `/api`. Single-user, no auth (v1). All responses JSON unless
a file download is noted. Errors use `{ "error": { "code", "message" } }` with an
appropriate 4xx/5xx status. Served by the same Express process that hosts the SPA
on `0.0.0.0:4000`.

## Bookmarks

### POST /api/bookmarks
Create (with automatic metadata) or resolve to existing on duplicate.
- Body: `{ url, title?, description?, note?, tags?: string[] }`
- Behavior: validates URL (400 if malformed); computes url_key; if a bookmark with
  that url_key exists → **200** `{ bookmark, duplicate: true }` (the existing
  bookmark, for editing) and no new row; else fetches metadata and creates →
  **201** `{ bookmark, duplicate: false }`. If metadata fetch fails, still creates
  with `metadata_status: "failed"`.

### GET /api/bookmarks
List with view, sort, pagination.
- Query: `view=main|read_later|archive` (default main), `sort=date_added|title|last_updated`,
  `page`, `page_size`, and `q` (search expression), `include_tags`, `exclude_tags`.
- Returns: `{ items: Bookmark[], total, page, page_size }`.

### GET /api/bookmarks/:id
Returns one bookmark with its tags, preserved copies, and rendered note HTML.

### PATCH /api/bookmarks/:id
Edit fields: `{ url?, title?, description?, note?, tags?, read_later?, is_read?, is_archived? }`.
- Editing `url` re-computes url_key; if it collides with another bookmark → **409**
  `{ error, existingId }` (no duplicate created, FR-006).

### DELETE /api/bookmarks/:id
Permanently deletes (used after confirmation in UI).

### POST /api/bookmarks/:id/retry-metadata
Re-attempts metadata fetch; updates fields and `metadata_status`.

## Bulk actions

### POST /api/bookmarks/bulk
- Body: one of
  - `{ ids: number[], action, params? }`
  - `{ selection: { view, q, include_tags, exclude_tags }, action, params? }` — "select all matching"
- `action`: `add_tags` | `remove_tags` (params: `tags[]`), `archive`, `unarchive`,
  `mark_read`, `mark_unread`, `delete`.
- Returns: `{ affected: number }`. Executed in a single transaction.

## Tags

### GET /api/tags?prefix=...
Returns tags (optionally filtered by prefix) for autocomplete suggestions (FR-010).

### Tag uniqueness
Creating/assigning a tag by name reuses an existing case-insensitive match; the API
never creates two tags with the same name (FR-010a). (No standalone create endpoint
required; tags are created implicitly when assigned.)

## Search

### GET /api/search
- Query: `q` (expression supporting `#tag`, `"phrases"`, AND/OR/NOT, parentheses,
  quoted-literal operators), plus `view`, `sort`, `page`, `page_size`,
  `include_tags`, `exclude_tags`.
- Malformed `q` → **400** `{ error: { code: "bad_query", message } }` (FR-013).
- Returns same shape as GET /api/bookmarks.
- (Search may be folded into GET /api/bookmarks via `q`; documented separately for clarity.)

## Saved searches

### GET /api/saved-searches → list
### POST /api/saved-searches → `{ name, query, include_tags, exclude_tags }`
### PATCH /api/saved-searches/:id → rename / edit
### DELETE /api/saved-searches/:id

## Import / export

### POST /api/import
- Multipart upload of a Netscape bookmark HTML file.
- Preserves title, tags (TAGS attr + folder→tag), and ADD_DATE where present;
  routes each entry through dedup.
- Returns: `{ added, skipped_duplicates, failed, details? }` (FR-028).

### GET /api/export
- Returns a Netscape bookmark HTML file download (`text/html`, attachment)
  re-importable by browsers and this app (FR-027).

## Preservation

### POST /api/bookmarks/:id/preserve
- Body: `{ local?: true, archive_org?: false }`.
- `local`: captures self-contained HTML, or PDF when the destination is a PDF;
  stores file + PreservedCopy row.
- `archive_org`: submits to Internet Archive Save Page Now; stores snapshot ref.
- Failures → **502**/**200 with status** and a message; bookmark unaffected (FR-032).
- Returns: `{ preserved: PreservedCopy[] }`.

### GET /api/bookmarks/:id/preserved/:copyId
- Serves the stored self-contained HTML or PDF file for offline reopening.

## Preferences

### GET /api/preferences → current settings
### PUT /api/preferences → `{ default_sort, items_per_page, text_size }`; persisted (FR-033).

## Static / readiness

### GET /
- Serves the built SPA. The app marks a visible element `data-harness-ready="true"`
  after the initial view and its data have loaded (empty state counts as ready).
