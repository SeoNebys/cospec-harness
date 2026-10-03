# API Contract: Bookmark Manager

JSON REST API served under `/api` by the same server that serves the UI.
All request and response bodies are JSON. Timestamps are ISO 8601 strings.

## Resource shapes

**Bookmark**
```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "An article",
  "notes": "Read later",
  "tags": ["work", "reading"],
  "created_at": "2026-09-18T10:00:00.000Z"
}
```

## Endpoints

### GET /api/bookmarks
List bookmarks, newest first. Supports optional filtering (FR-005, FR-006, FR-010).

Query parameters (all optional, combinable):
- `q` — keyword; case-insensitive substring match against title, url, notes.
- `tag` — tag name; only bookmarks carrying this tag.

Response `200`:
```json
{ "bookmarks": [ /* Bookmark objects */ ] }
```
Empty result returns `{ "bookmarks": [] }` (UI renders empty/no-results state, FR-012).

### POST /api/bookmarks
Create a bookmark (FR-001, FR-002, FR-003, FR-011).

Request:
```json
{ "url": "example.com", "title": "Optional", "notes": "Optional", "tags": ["work"] }
```
- `url` required. Scheme-less input is normalized (`https://` prepended).
- `title`, `notes`, `tags` optional; `tags` is an array of names.

Response `201`:
```json
{ "bookmark": { /* created Bookmark */ }, "duplicate": false }
```
- `duplicate` is `true` when another bookmark already has the same normalized
  url; the bookmark is still created (FR-011) and the client shows a warning.

Response `400` (invalid url, FR-003):
```json
{ "error": "Please enter a valid web address (for example, https://example.com)." }
```

### GET /api/bookmarks/:id
Fetch one bookmark. `200` with `{ "bookmark": {...} }`, or `404` if not found.

### PUT /api/bookmarks/:id
Update a bookmark's url, title, notes, and/or tags (FR-008).

Request (any subset of editable fields):
```json
{ "url": "https://example.com", "title": "New title", "notes": "", "tags": ["reading"] }
```
- Provided `url` is validated/normalized as in POST; invalid → `400`.
- Provided `tags` replaces the bookmark's tag set.

Response `200`: `{ "bookmark": { /* updated */ } }`. `404` if not found.

### DELETE /api/bookmarks/:id
Delete a bookmark (FR-009). Confirmation is a UI concern; the API removes on call.

Response `204` (no body). `404` if not found. Linked tag associations are
removed via cascade.

### GET /api/tags
List all tag names in use (to populate the tag filter, FR-010).

Response `200`:
```json
{ "tags": ["reading", "work"] }
```

## Error format

Non-2xx responses use `{ "error": "<human-readable message>" }` with an
appropriate status code (`400` validation, `404` not found, `500` unexpected).

## Requirement coverage

| Endpoint | Requirements |
|----------|--------------|
| GET /api/bookmarks | FR-005, FR-006, FR-010, FR-012 |
| POST /api/bookmarks | FR-001, FR-002, FR-003, FR-011 |
| PUT /api/bookmarks/:id | FR-002, FR-003, FR-008 |
| DELETE /api/bookmarks/:id | FR-009 |
| GET /api/tags | FR-010 |
| (client opens `url`) | FR-007 |
