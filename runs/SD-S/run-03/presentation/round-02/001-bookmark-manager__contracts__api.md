# API Contract: Bookmark Manager

The backend exposes a small JSON HTTP API consumed by the static frontend. All
request/response bodies are JSON. This contract is the seam under integration
test (Supertest). Each endpoint notes the functional requirements it satisfies.

Base path: `/api`

## Bookmark object (response shape)

```json
{
  "id": 1,
  "url": "https://example.com/article",
  "title": "Example Article",
  "note": "Read this later",
  "tags": ["reading", "reference"],
  "created_at": "2026-07-13T10:00:00.000Z"
}
```

## GET /api/bookmarks

List bookmarks. Supports search, tag filter, and ordering. (FR-006, FR-008, FR-009, FR-014)

Query parameters (all optional):
- `q` — text term; matches title, url, note, and tag names (FR-008).
- `tag` — restrict to bookmarks carrying this tag name (FR-009).
- `sort` — `newest` (default) or `oldest`, by `created_at` (FR-014).

Responses:
- `200` → `{ "bookmarks": [ <Bookmark>, ... ] }`. Empty array when nothing matches (drives the empty-result / empty-state UI; FR-015).

## POST /api/bookmarks

Create a bookmark. (FR-001, FR-002, FR-003, FR-004, FR-010, FR-013)

Request body:
```json
{ "url": "https://example.com", "title": "", "note": "", "tags": ["reading"], "confirmDuplicate": false }
```
- `url` — required.
- `title` — optional; if blank, the server auto-fetches the page title, falling back to the url (FR-003).
- `note`, `tags` — optional.
- `confirmDuplicate` — optional; when `true`, save proceeds even if a duplicate is detected.

Responses:
- `201` → `{ "bookmark": <Bookmark> }` on success.
- `400` → `{ "error": "..." }` when `url` is missing or not a valid http(s) URL (FR-002).
- `409` → `{ "error": "duplicate", "existing": <Bookmark> }` when the normalised url already exists and `confirmDuplicate` was not set (FR-013). Client re-submits with `confirmDuplicate: true` to override.

## GET /api/bookmarks/:id

Fetch a single bookmark. (Supports the edit flow.)

Responses:
- `200` → `{ "bookmark": <Bookmark> }`.
- `404` → `{ "error": "not_found" }`.

## PUT /api/bookmarks/:id

Update a bookmark's url, title, note, and/or tags. (FR-011)

Request body: any subset of `{ "url", "title", "note", "tags" }`.

Responses:
- `200` → `{ "bookmark": <Bookmark> }` with updated values.
- `400` → `{ "error": "..." }` if a supplied `url` is invalid (FR-002).
- `404` → `{ "error": "not_found" }`.

## DELETE /api/bookmarks/:id

Delete a bookmark. (FR-012)

The confirmation step (FR-012) is enforced in the UI before this call is made;
the endpoint performs the actual removal.

Responses:
- `204` → no content, on success.
- `404` → `{ "error": "not_found" }`.

## GET /api/tags

List all tag names in use, for populating the tag-filter control. (FR-009)

Responses:
- `200` → `{ "tags": ["reading", "reference", ...] }`.

## Error format

All error responses use `{ "error": "<machine-readable code or message>" }` with
an appropriate HTTP status. The frontend maps these to user-friendly messages
(clear rejection on invalid url, duplicate warning, etc.).
