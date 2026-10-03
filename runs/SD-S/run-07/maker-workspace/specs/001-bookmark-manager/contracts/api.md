# API Contract: Bookmark Manager

JSON HTTP API served by the same Node.js process under `/api`. All request and
response bodies are JSON. The static frontend is served from `/`.

Base URL (review): `http://maker:4000` (VM capture uses `http://127.0.0.1:4000`).

## Conventions

- Success responses use 2xx; errors use 4xx with `{ "error": "message" }`.
- Timestamps are ISO-8601 strings.
- A `Bookmark` object:

```json
{
  "id": 1,
  "url": "https://example.com/article",
  "title": "Example Article",
  "tags": ["reading", "work"],
  "createdAt": "2026-09-18T10:00:00.000Z",
  "updatedAt": "2026-09-18T10:00:00.000Z"
}
```

## GET /api/bookmarks

List bookmarks, newest first (FR-006). Supports optional filters.

**Query parameters** (optional):

- `q` — keyword; case-insensitive substring match against title or url (FR-007).
- `tag` — tag name; return only bookmarks carrying that tag (FR-012).

**Response** `200`:

```json
{ "bookmarks": [ /* Bookmark objects, newest first */ ] }
```

Empty array is valid and drives the empty / no-results states (FR-013).

## POST /api/bookmarks

Create a bookmark (FR-001).

**Request body**:

```json
{ "url": "https://example.com/article", "title": "optional", "tags": ["optional"] }
```

**Behavior**:

- `url` required and must be a well-formed http/https URL, else `400`
  `{ "error": "A valid web address is required." }` (FR-002).
- If `title` omitted/empty, server derives it from the page, falling back to the
  url (FR-003).
- Normalized-URL duplicate → `409`
  `{ "error": "This address is already bookmarked.", "existingId": <id> }` and no
  new entry is created (FR-011).

**Response** `201`: the created `Bookmark` object.

## PATCH /api/bookmarks/:id

Update a bookmark's title and/or tags (FR-004, FR-009, FR-012).

**Request body** (any subset):

```json
{ "title": "New title", "tags": ["work", "later"] }
```

**Response** `200`: the updated `Bookmark`. Unknown id → `404`.

## DELETE /api/bookmarks/:id

Delete a bookmark (FR-010). The confirmation step is enforced in the UI before
this call is made.

**Response** `204` (no body). Unknown id → `404`.

## GET /api/tags

List all tag names currently in use (to populate the tag filter, FR-012).

**Response** `200`:

```json
{ "tags": ["reading", "work"] }
```
