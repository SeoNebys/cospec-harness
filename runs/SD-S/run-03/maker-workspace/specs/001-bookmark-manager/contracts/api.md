# API Contract: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16

A same-origin JSON REST API served by the application on port 4000. All request
and response bodies are JSON. Timestamps are ISO 8601 strings.

## Resource shapes

**Bookmark**

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "An Example Article",
  "tags": ["reading", "tech"],
  "createdAt": "2026-09-16T10:00:00.000Z",
  "updatedAt": "2026-09-16T10:00:00.000Z"
}
```

**Error**

```json
{ "error": { "code": "duplicate_url", "message": "This URL is already bookmarked." } }
```

Error codes: `invalid_url`, `duplicate_url`, `validation_error`, `not_found`.

## Endpoints

### GET /api/bookmarks

List bookmarks, most-recently-saved first (FR-005, FR-014).

Query parameters (optional, combinable):
- `q` — keyword; matches title, url, or tag name, case-insensitive substring
  (FR-012).
- `tag` — tag name; restrict to bookmarks carrying this tag (FR-011). May be
  repeated to require multiple tags.

Response `200`:
```json
{ "bookmarks": [ /* Bookmark, ... */ ] }
```
An empty array is returned for both "no bookmarks" and "no matches"; the client
distinguishes the two by whether any filter was applied (FR-013).

### POST /api/bookmarks

Create a bookmark (FR-001, FR-003, FR-009, FR-010).

Request:
```json
{ "url": "https://example.com/article", "title": "Optional custom title", "tags": ["reading", "tech"] }
```
- `url` required; `title` optional (server derives when omitted/blank); `tags`
  optional array of names.

Responses:
- `201` → `{ "bookmark": { /* Bookmark */ } }`
- `400` `invalid_url` → malformed or non-http(s) address (FR-002).
- `409` `duplicate_url` → normalized url already bookmarked (FR-009).

### GET /api/bookmarks/:id

Response `200` → `{ "bookmark": { /* Bookmark */ } }`; `404` `not_found`.

### PUT /api/bookmarks/:id

Update title, url, and/or tags (FR-007).

Request (any subset):
```json
{ "url": "https://example.com/new", "title": "New Title", "tags": ["tech"] }
```
Responses:
- `200` → `{ "bookmark": { /* Bookmark */ } }`
- `400` `invalid_url`; `409` `duplicate_url` (excluding this bookmark);
  `404` `not_found`.

### DELETE /api/bookmarks/:id

Permanently delete (FR-008). Confirmation of intent is handled in the UI before
this call is made.

Responses: `204` no content; `404` `not_found`.

### GET /api/tags

List known tag names for filter controls (supports FR-011).

Response `200`:
```json
{ "tags": [ { "name": "reading", "count": 4 }, { "name": "tech", "count": 9 } ] }
```

## UI contract (application-level)

- The root page (`/`) renders the bookmark list or an empty state and sets
  `data-harness-ready="true"` once that initial content has loaded.
- Bookmark titles in the list are links that open the original `url` in a new
  browser tab (FR-006).
- Deleting a bookmark presents a confirmation step before issuing `DELETE`
  (FR-008).
- The list view shows a distinct empty state (no bookmarks) versus a no-results
  state (filter/search matched nothing) (FR-013).
