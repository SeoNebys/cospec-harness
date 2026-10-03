# API Contract: Bookmark Manager

**Feature**: 001-bookmark-manager
**Style**: JSON over HTTP (REST). Single-user, no authentication (FR-015).
**Base path**: `/api`

All request and response bodies are JSON. Timestamps are ISO-8601 strings.

## Resource shape: Bookmark

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "Example Article",
  "note": "Read later",
  "tags": ["reading", "tech"],
  "createdAt": "2026-09-27T10:15:00.000Z",
  "updatedAt": "2026-09-27T10:15:00.000Z"
}
```

## Endpoints

### GET /api/bookmarks

List bookmarks, newest first. Optional filtering.

- **Query params**:
  - `search` (optional): keyword matched against title, url, and note (FR-007).
  - `tag` (optional): return only bookmarks carrying this tag (FR-008).
  - Both may be combined.
- **200 OK**: `{ "bookmarks": [ <Bookmark>, ... ] }` (empty array when none match —
  the client renders the empty/no-results state, FR-014).

### POST /api/bookmarks

Create a bookmark (FR-001, FR-003, FR-004, FR-005).

- **Body**: `{ "url": "<required>", "title": "<optional>", "note": "<optional>", "tags": ["<optional>", ...] }`
- **201 Created**: the created `<Bookmark>` (title derived if omitted, FR-003).
- **400 Bad Request**: `{ "error": "message" }` when `url` is missing or not a
  valid http/https address (FR-002).
- **409 Conflict**: `{ "error": "This address is already saved.", "existingId": <id> }`
  when the normalized URL already exists (FR-013).

### GET /api/bookmarks/:id

- **200 OK**: the `<Bookmark>`.
- **404 Not Found**: `{ "error": "Bookmark not found." }`.

### PUT /api/bookmarks/:id

Edit a bookmark's title, url, note, and tags (FR-010).

- **Body**: `{ "url": "...", "title": "...", "note": "...", "tags": [...] }`
  (fields present are updated; `updatedAt` is refreshed).
- **200 OK**: the updated `<Bookmark>`.
- **400 Bad Request**: invalid url (FR-002).
- **404 Not Found**: unknown id.
- **409 Conflict**: the new url duplicates a different bookmark (FR-013).

### DELETE /api/bookmarks/:id

Delete a bookmark (FR-011). The confirmation step is enforced in the UI before
this call is made.

- **204 No Content**: deleted.
- **404 Not Found**: unknown id.

### GET /api/tags

List distinct tag names in use, for the filter UI (FR-008).

- **200 OK**: `{ "tags": ["reading", "tech", ...] }`.

## Error format

All errors use `{ "error": "<human-readable message>" }` with the status codes
above, so the client can show clear, user-friendly messages (FR-002, FR-013).
