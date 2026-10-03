# Phase 1 Contract: HTTP API

JSON over HTTP, served by the same Node app that hosts the static UI on
`0.0.0.0:4000`. All responses are JSON unless noted. Errors use a consistent
shape `{ "error": { "code": string, "message": string, "details"?: any } }`
with an appropriate HTTP status. A session cookie identifies the single local
user.

Traceability to functional requirements (FR-xxx) is noted per endpoint.

## Metadata

### POST /api/metadata
Fetch metadata for a candidate address before saving. (FR-002, FR-004)
- Body: `{ "url": string }`
- 200: `{ "url", "canonical_key", "title", "description", "iconUrl",
  "previewImageUrl", "fetched": boolean, "fallbacksUsed": string[] }`
- If a bookmark with the same `canonical_key` exists: 200 with
  `{ "existingId": number }` so the UI can open it for editing (FR-006, US2).
- 422 for malformed/empty URL (FR-005).

## Bookmarks

### GET /api/bookmarks
List bookmarks for a view. (FR-010, FR-012, FR-013, FR-017)
- Query params: `view` = `main|unread|archive` (default `main`);
  `q` = search-grammar string (optional, FR-013/FR-014);
  `tag` = repeatable included tag; `nottag` = repeatable excluded tag;
  `sort` = `date_added_desc|date_added_asc|title_asc|title_desc`;
  `page`, `pageSize` (defaults from preferences, FR-027).
- 200: `{ "items": Bookmark[], "total": number, "page", "pageSize" }`.
- Archive filter is implied by `view` (archived excluded from main/unread).
- 400 with a clear message for a malformed search query (FR-015, US4-8).

### POST /api/bookmarks
Create a bookmark. (FR-001, FR-003, FR-006, FR-016)
- Body: `{ "url", "title"?, "description"?, "tags"?: string[],
  "noteHtml"?, "readLater"?: boolean }`
- 201: `{ "bookmark": Bookmark }`. `is_unread` = true only if `readLater`.
- If the address already exists: 409 `{ "existingId" }` (UI opens it, US2).
- 422 for invalid URL.

### GET /api/bookmarks/:id
Fetch one bookmark with tags and note. (FR-007)

### PATCH /api/bookmarks/:id
Edit fields. (FR-003, FR-007, FR-008, FR-016)
- Body may include any of: `url`, `title`, `description`, `tags` (full set for
  single-item edit), `noteHtml` (sanitised server-side), `isUnread`,
  `isArchived`.
- Editing `url` to a colliding address: 409 `{ "existingId" }` (FR-006, US5-4).
- 200: `{ "bookmark": Bookmark }`.

### DELETE /api/bookmarks/:id
Permanently delete. Requires `?confirm=true`. (FR-018)
- 200: `{ "deleted": true }`; 428 if confirm missing.

## Bulk actions (FR-019, FR-020)

### POST /api/bookmarks/bulk
- Body selects targets by **either**:
  - `{ "ids": number[] }`, or
  - `{ "match": { "view", "q", "tags"[], "notTags"[] } }` (all current matches).
- And specifies an action:
  - `{ "action": "addTags", "tags": string[] }` — adds only, never replaces.
  - `{ "action": "removeTags", "tags": string[] }` — removes only.
  - `{ "action": "setUnread", "value": boolean }`
  - `{ "action": "setArchived", "value": boolean }`
  - `{ "action": "delete", "confirm": true }`
- 200: `{ "updated": number, "failures": [{ "id", "reason" }] }` (partial
  failures reported, FR-020).

## Tags (FR-009)

### GET /api/tags
- 200: `{ "tags": [{ "name", "count" }] }`, most-used first (suggestions).

## Saved searches (FR-021)

### GET /api/saved-searches → `{ "items": SavedSearch[] }`
### POST /api/saved-searches → body `{ "name", "query", "includedTags"[], "excludedTags"[] }`
### PATCH /api/saved-searches/:id → rename / update
### DELETE /api/saved-searches/:id

Applying a saved search is done by the client reissuing `GET /api/bookmarks`
with the saved `q`/`tag`/`nottag` values.

## Preservation (FR-024, FR-026, US11)

### POST /api/bookmarks/:id/preserve
Create a local self-contained copy.
- 200: `{ "preservedKind": "html"|"pdf", "preservedPath" }`.
- 502 `{ "error" }` with the bookmark still intact if capture fails (US11-4).

### GET /api/bookmarks/:id/preserved
Serve the stored self-contained HTML (`text/html`) or PDF
(`application/pdf`) for offline viewing (FR-024).

## Internet Archive (FR-025, FR-026)

### POST /api/bookmarks/:id/archive-org
- 200: `{ "archiveOrgUrl": string }` on success.
- 502 `{ "error", "message" }` with bookmark intact if the service is
  unreachable (US11-4). The response distinguishes "service unavailable" so the
  UI reports it honestly.

## Import / export (FR-022, FR-023)

### POST /api/import
- Body: Netscape bookmark HTML file (multipart or raw).
- 200: `{ "imported": number, "skippedDuplicates": number,
  "defaultsApplied": number }`.
- 422 with a clear message and nothing imported for an invalid file (US10-4).

### GET /api/export
- 200: `text/html` Netscape bookmark file preserving titles, `TAGS`, and
  `ADD_DATE` (FR-022, US10-1).

## Preferences (FR-027)

### GET /api/preferences → `{ "defaultSort", "itemsPerView", "textSize" }`
### PUT /api/preferences → same body; persisted and echoed back.

## Shared type: Bookmark (response shape)

```json
{
  "id": 1,
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "A short summary.",
  "iconUrl": "https://example.com/favicon.ico",
  "previewImageUrl": "https://example.com/og.png",
  "noteHtml": "<p>My <strong>note</strong>.</p>",
  "tags": ["reading", "travel"],
  "isUnread": false,
  "isArchived": false,
  "preservedKind": null,
  "archiveOrgUrl": null,
  "dateAdded": "2026-09-18T10:00:00Z",
  "updatedAt": "2026-09-18T10:00:00Z"
}
```
