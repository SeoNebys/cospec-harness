# Contract: REST API

Base path `/api`. JSON request/response bodies (except snapshot/import/export
which use binary/HTML). Single-user, no authentication. All endpoints served by
the same Node process that serves the static frontend.

Conventions: timestamps are epoch milliseconds; errors return an appropriate 4xx
with `{ "error": "<message>" }`. Archived bookmarks are excluded from normal list
and search unless explicitly requested via the archive endpoints/params.

## Bookmarks

### `GET /api/bookmarks`
List/search/sort bookmarks (non-archived by default).

Query params:
- `q` — search query string (grammar in `search-query-grammar.md`).
- `tag` — restrict to a single tag (tag filter).
- `filterId` — apply a saved filter (query + include/exclude tags); combined with
  `q` if both present.
- `view` — `all` (default) | `unread` | `archived`.
- `sort` — `date_added_desc` (default) | `date_added_asc` | `title_asc` |
  `title_desc`.

Response `200`: `{ "items": [Bookmark], "total": <int> }` where `Bookmark`
matches the data model fields, including tag names and offline/IA status.

### `POST /api/bookmarks/preview`
Fetch auto-collected details for review **before** the initial save (US1
scenario 2, FR-002/003). Creates nothing.

Body: `{ "url": "..." }`.

Behavior:
- Reject empty/malformed `url` → `400` (FR-004).
- Normalize `url`; if `normalized_url` already exists → `200` with
  `{ "duplicate": true, "bookmark": <existing> }` so the UI opens the existing
  bookmark for editing instead of a fresh save (FR-006).
- Otherwise fetch metadata with a short timeout and return
  `{ "duplicate": false, "url", "normalized_url", "title", "description",
  "favicon_url", "preview_image_url", "fallback": <bool> }`. On timeout/failure,
  return fallback details (title derived from the URL, empty description) with
  `"fallback": true` so the user can still review and continue (FR-005, US1
  scenario 4). Response `200`.

### `POST /api/bookmarks`
Confirm and create the bookmark from the reviewed (possibly edited) details.

Body: `{ "url": "...", "title": "...", "description"?: "...", "tags"?: [..],
"favicon_url"?: "...", "preview_image_url"?: "..." }` (title/description are the
values the user reviewed/edited in the preview step; `favicon_url` and
`preview_image_url` are the collected values carried from the preview response so
they are persisted and remain available after reload — FR-002/008).

Behavior:
- Reject empty/malformed `url` → `400` (FR-004).
- Normalize `url`; if `normalized_url` already exists → `200` with
  `{ "duplicate": true, "bookmark": <existing> }` (FR-006) — the UI opens it for
  editing rather than creating a duplicate.
- Else create immediately with the provided title/description and the collected
  `favicon_url`/`preview_image_url`, `saved_date = now`,
  `is_read = 0`, `offline_status = pending`, and return `201` with the created
  bookmark **without waiting** for capture. The automatic offline-copy attempt
  (FR-029) is then kicked off asynchronously and updates `offline_status`
  (`available`/`unavailable`) when it completes; it never delays this response.

### `GET /api/bookmarks/:id`
Response `200`: single `Bookmark`; `404` if missing.

### `PATCH /api/bookmarks/:id`
Partial update of `title`, `description`, `url`, `notes_html` (sanitized
server-side), `tags`, `is_read`, `is_archived`. Response `200` updated bookmark.
Changing `url` re-normalizes and re-checks uniqueness.

### `DELETE /api/bookmarks/:id`
Hard delete (distinct from archive). Response `204`. (UI provides confirm/undo.)

### `GET /api/bookmarks/:id/snapshot`
Return the stored offline copy: `application/pdf` for PDF, `multipart/related`
(MHTML) otherwise. `404` if `offline_status != available`.

### `POST /api/bookmarks/:id/preserve`
Trigger Internet Archive "Save Page Now" for this bookmark (FR-030). Sets
`ia_status = pending`; on completion `saved` (+`ia_snapshot_url`) or `failed`.
Response `202` with current IA status. Never affects saving; retryable.

## Bulk actions

### `POST /api/bookmarks/bulk`
Apply one action to many bookmarks (FR-023/024).

Body (target is either explicit ids or the current query for "select all
matching"):
```json
{
  "target": { "ids": [1,2,3] }
           | { "match": { "q": "...", "tag": "...", "filterId": "...", "view": "all|unread|archived" } },
  "action": "add_tags" | "remove_tags" | "mark_read" | "mark_unread"
          | "archive" | "restore" | "delete",
  "tags": ["..."]   // required for add_tags/remove_tags
}
```
Response `200`: `{ "affected": <int> }`. `delete` is guarded by client
confirm/undo.

## Tags

### `GET /api/tags`
Response `200`: `[{ "id", "name", "count" }]` — all tags with bookmark counts.

### `GET /api/tags/suggest?q=<prefix>`
Response `200`: `[ "tagname", ... ]` existing tags matching the prefix, for
type-ahead suggestions while entering tags (FR-018).

## Saved filters

### `GET /api/filters` → `[SavedFilter]`
### `POST /api/filters`
Body: `{ "name", "query", "include_tags": [..], "exclude_tags": [..] }` →
`201 SavedFilter` (FR-028).
### `PATCH /api/filters/:id` → `200 SavedFilter`
### `DELETE /api/filters/:id` → `204`

## Preferences

### `GET /api/preferences` → `200 Preferences`
### `PUT /api/preferences`
Body: `{ "default_sort", "density", "text_size" }` → `200 Preferences`
(persisted across sessions, FR-033).

## Import / export

### `POST /api/import`
Body: browser bookmark HTML file (Netscape format), `text/html` or multipart.
Parses entries preserving title, tags (`TAGS` attr), saved date (`ADD_DATE`);
de-duplicates by normalized URL (FR-031). Response `200`:
`{ "imported": <int>, "skipped": <int>, "duplicates": <int> }`.

### `GET /api/export`
Response `200` `text/html`: Netscape bookmark HTML with `ADD_DATE` and `TAGS`
populated for every bookmark (FR-032). `Content-Disposition: attachment`.

## Error responses (common)

| Status | When |
|--------|------|
| `400` | Invalid/empty URL; missing required fields; malformed body. |
| `404` | Unknown bookmark/filter id; snapshot not available. |
| `409` | (Optional) explicit conflict signaling; duplicates on create are instead returned as `200 { duplicate: true }`. |
| `500` | Unexpected server error. External capture/IA failures are reported as status fields, not 500s. |
