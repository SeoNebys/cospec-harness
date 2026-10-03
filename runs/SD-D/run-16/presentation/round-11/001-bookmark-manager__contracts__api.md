# API Contract: Bookmark Manager

**Feature**: 001-bookmark-manager
**Style**: JSON REST over HTTP. Single-user, no authentication. All request/response
bodies are `application/json` unless noted. Errors use standard HTTP status codes with
`{ "error": { "code": string, "message": string } }`.

This contract maps endpoints to functional requirements (FR) so tasks and tests can be
derived directly. Field shapes follow [data-model.md](../data-model.md).

## Bookmarks

### POST /api/bookmarks — Save a bookmark
Maps: FR-001, FR-002, FR-003, FR-016.
- Body: `{ "address": string, "title"?: string, "description"?: string, "note"?: string, "tags"?: string[] }`
- Behavior: validate address (400 on empty/malformed); if `address` already exists,
  respond `200` with `{ "bookmark": {...}, "existing": true }` so the client opens it
  for editing (FR-016); otherwise fetch page metadata (title/description/icon/preview,
  with address fallback), insert, respond `201` with `{ "bookmark": {...}, "existing": false }`.
- New bookmarks default to unread (FR-020).

### GET /api/bookmarks — List bookmarks
Maps: FR-006, FR-011, FR-027.
- Query: `sort` (`newest|oldest|title|updated`), `view` (`normal|unread|archived`),
  `tag` (filter by one tag), `limit`, `offset`.
- `normal` and `unread` exclude archived; `archived` returns only archived (FR-021/022).
- Response: `{ "items": Bookmark[], "total": number }`. Empty list is a valid state.

### GET /api/bookmarks/:id — Get one bookmark
- Response: `{ "bookmark": {...}, "noteHtml": string }` where `noteHtml` is the
  sanitized rendered Markdown note (FR-038).

### PATCH /api/bookmarks/:id — Edit a bookmark
Maps: FR-004, FR-015, FR-018, FR-021.
- Body (any subset): `{ "title"?, "address"?, "description"?, "note"?, "tags"?: string[], "isUnread"?: boolean, "isArchived"?: boolean }`
- Updates `date_updated`. Editing `address` to a value used by another bookmark → 409.

### DELETE /api/bookmarks/:id — Delete a bookmark
Maps: FR-017.
- Requires explicit confirmation from the client (query `?confirm=true`); removes the
  row, tag links, and preserved files. 204 on success.

### GET /api/bookmarks/:id/open — Open target
Maps: FR-007.
- Returns `{ "address": string }`; the client opens it in a new browser tab. (Opening
  is a client action; this endpoint exists for completeness/telemetry-free use.)

## Search

### GET /api/search — Search bookmarks
Maps: FR-008, FR-009, FR-010, FR-011.
- Query: `q` (query string), `sort`, `view` (`normal|unread`), `limit`, `offset`.
- Parses `q` (phrases, `#tag`, AND/OR/NOT, parentheses, implicit AND, quoted literal
  operators); matches case-insensitively across title, description, note, address;
  excludes archived from normal search.
- Response: `{ "items": Bookmark[], "total": number, "matchedIds": number[] }`.
  `matchedIds` supports "select all matching" (FR-025). A malformed query returns 400
  with a clear message (edge case).

## Tags

### GET /api/tags — List tags (with counts)
Maps: FR-014.
- Response: `{ "tags": [{ "name": string, "count": number }] }`.

### GET /api/tags/suggest?prefix= — Tag suggestions
Maps: FR-013.
- Response: `{ "suggestions": string[] }` — existing tags matching the prefix.

## Bulk actions

### POST /api/bookmarks/bulk — Apply an action to many
Maps: FR-024, FR-025, FR-026.
- Body: `{ "select": { "ids": number[] } | { "matching": { "q"?: string, "tag"?: string, "view"?: string } }, "action": { "type": "addTags"|"removeTags"|"setUnread"|"setArchived"|"delete", "tags"?: string[], "value"?: boolean, "confirm"?: boolean } }`
- `matching` resolves to all bookmarks matching the current query/filter (including
  off-screen). `delete` requires `confirm: true`.
- Response: `{ "affected": number }`.

## Saved searches

### GET /api/saved-searches — List
### POST /api/saved-searches — Create
### PUT /api/saved-searches/:id — Edit
### DELETE /api/saved-searches/:id — Delete
### GET /api/saved-searches/:id/run — Run
Maps: FR-029, FR-030.
- SavedSearch body: `{ "name": string, "queryText": string, "includedTags": string[], "excludedTags": string[] }`.
- Run applies `queryText` plus included/excluded tags; response mirrors /api/search.

## Preferences

### GET /api/preferences — Read
### PUT /api/preferences — Update
Maps: FR-027, FR-028.
- Body: `{ "defaultSort": "newest"|"oldest"|"title"|"updated", "itemsShown": number, "textSize": "small"|"medium"|"large" }`.

## Preservation

### POST /api/bookmarks/:id/preserve — Offline copy
Maps: FR-034, FR-035, FR-037.
- Renders page → single self-contained HTML stored under `data/preserved/`; if the
  address is a PDF, stores the original PDF instead. Sets `preserved_copy_path/kind`.
- On failure: 502 with clear message; bookmark unchanged.
- Response: `{ "bookmark": {...} }`.

### GET /api/bookmarks/:id/preserved — View offline copy
- Serves the stored HTML (`text/html`) or PDF (`application/pdf`). 404 if none.

### POST /api/bookmarks/:id/archive-org — Internet Archive snapshot
Maps: FR-036, FR-037.
- Submits address to Save Page Now; stores returned snapshot URL in `archive_org_url`.
- On failure: 502 with clear message; bookmark unchanged.
- Response: `{ "bookmark": {...} }`.

## Import / Export

### GET /api/export — Export bookmarks
Maps: FR-031.
- Response: `text/html` Netscape bookmark file (attachment) including `ADD_DATE` and
  `TAGS`.

### POST /api/import — Import a bookmark file
Maps: FR-032, FR-033.
- Body: multipart file upload (Netscape bookmark HTML).
- Skips existing addresses; imports new ones preserving title, tags, and original
  date-added (fallbacks: address as title, empty tags, import time as date-added).
- Malformed file → 400 with clear message, no partial corruption.
- Response: `{ "added": number, "skipped": number }`.

## Notes

- Every endpoint that returns a bookmark returns the full Bookmark shape from
  data-model.md.
- Contract-level acceptance is verified by integration tests (supertest) per the
  mapped FRs; end-to-end UI flows are covered by the quickstart scenarios.
