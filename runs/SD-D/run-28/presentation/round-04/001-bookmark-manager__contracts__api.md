# API Contract: Bookmark Manager

HTTP/JSON API served by the backend on `0.0.0.0:4000`. Single-user, no auth. All
request/response bodies are JSON unless noted. Paths are relative to the server
root; the SPA is served from `/`.

Conventions: `2xx` success; `400` validation error (body `{ "error": {code,
message, details?} }`); `404` unknown id; `409` duplicate; `502` upstream
(Internet Archive / capture) failure that the client should surface without data
loss.

## Bookmarks

### `GET /api/bookmarks`
List/search bookmarks. Query params:
- `q` — advanced search string (see search-grammar.md). Optional.
- `tag` — repeatable; simple tag filter (equivalent to `#tag` AND terms).
- `view` — saved-view id (applies its query + include/exclude tags).
- `scope` — `active` (default, excludes archived), `unread`, `archived`, `all`.
- `sort` — one of the sort keys (FR-010); defaults to preference.
- `page`, `pageSize` — pagination; `pageSize` default from preferences.

Response: `{ items: Bookmark[], total, page, pageSize }`. Each `Bookmark`
includes display title/description (override applied), tags, favicon/preview
refs, read/archived flags, `captureStatus`, dates, and snapshot/archive refs.
Malformed `q` → `400` with a clear message (FR-013).

### `POST /api/bookmarks`
Create a bookmark. Body: `{ url, title?, description?, note?, tags?[], unread? }`.
- Normalizes and validates `url` (FR-004).
- If `url_key` already exists → `409` with `{ existingId }`; the client navigates
  to that bookmark for editing (FR-007/US-2). No duplicate created.
- Otherwise inserts, returns `201` with the new bookmark (capture pending), and
  enqueues metadata + snapshot capture (FR-002/FR-005/FR-022).

### `GET /api/bookmarks/:id`
Full bookmark including captured vs. user fields and capture status.

### `PATCH /api/bookmarks/:id`
Edit fields: `title`, `description`, `note`, `url`, `tags[]`, `unread`,
`archived` (FR-003/FR-009/FR-014/FR-015/FR-018). Updates `date_modified`. Editing
`url` re-validates and re-checks duplicates.

### `DELETE /api/bookmarks/:id`
Permanent delete (FR-010). Confirmation is a client-side responsibility; server
also removes snapshot files.

### `POST /api/bookmarks/:id/archive-org`
Trigger Internet Archive submission (FR-023). `202` when accepted; on completion
the bookmark gains `archive_org_url`. Failure → `502` with a message; bookmark and
local snapshot unchanged.

### `GET /api/bookmarks/:id/snapshot`
Serve the preserved copy: the self-contained HTML, or the retained PDF with the
correct content type (FR-022).

## Bulk actions

### `POST /api/bookmarks/bulk`
Body: `{ selector, action }`.
- `selector` = `{ ids: string[] }` **or** `{ match: { q?, tag?[], scope? } }` to
  act on all bookmarks matching the current search/filter (FR-019, "select all
  matching").
- `action` = one of:
  - `{ type: "addTags", tags: string[] }`
  - `{ type: "removeTags", tags: string[] }`
  - `{ type: "setUnread", unread: boolean }`
  - `{ type: "archive", archived: boolean }`
  - `{ type: "delete" }` (permanent; client confirms first)
Response: `{ affected: number }` (FR-020). Target ≤500 in <5s (SC-005).

## Tags

### `GET /api/tags?prefix=...`
All tags, or those starting with `prefix`, with usage counts — powers tag
autocomplete/suggestions (FR-017) and tag filters (FR-016).

## Saved views

### `GET /api/views` · `POST /api/views` · `PATCH /api/views/:id` · `DELETE /api/views/:id`
CRUD for saved views defined by `{ name, query, includeTags[], excludeTags[] }`
(FR-021).

## Preferences

### `GET /api/preferences` · `PATCH /api/preferences`
Read/update `{ defaultSort, itemsShown, textSize }` (FR-026). Persisted globally.

## Import / Export

### `POST /api/import`
Multipart upload of a Netscape bookmark HTML file. Parses `HREF`/text/`ADD_DATE`/
`TAGS` (folders as fallback tags), merges on `url_key` (no duplicates), preserves
titles/tags/dates (FR-024, SC-006). Response: `{ imported, merged, skipped }`.
Newly imported bookmarks enqueue capture like manual saves.

### `GET /api/export`
Returns a Netscape bookmark HTML file (`text/html` download) representing the
collection, with tags written to the `TAGS` attribute for faithful round-trip
(FR-025).

## Notes
- `captureStatus` lets the UI show "metadata unavailable" / pending states
  (FR-005) and placeholders for missing favicon/preview (edge cases).
- Opening the original link (FR-029) is a client action (`window.open(url)`); the
  API is not involved.
