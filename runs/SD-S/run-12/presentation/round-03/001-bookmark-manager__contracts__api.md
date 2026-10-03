# API Contract: Bookmark Manager

**Feature**: 001-bookmark-manager
**Style**: REST over HTTP, JSON request/response bodies.
**Base**: served from the same origin as the client (`http://maker:4000` in review).

All responses are JSON. Errors use the shape `{ "error": "<message>" }` with an
appropriate 4xx/5xx status.

## Bookmark object (response shape)

```json
{
  "id": 1,
  "url": "https://example.com/page",
  "title": "Example",
  "displayLabel": "example.com/page",
  "notes": "",
  "tags": ["reading", "reference"],
  "dateAdded": "2026-09-18T10:00:00.000Z",
  "dateUpdated": "2026-09-18T10:00:00.000Z"
}
```

`displayLabel` is server-computed (title, else derived from url) per FR-004.

## GET /api/bookmarks

List bookmarks (FR-005, FR-014). Default order: most recently added first.

**Query parameters** (all optional):

- `q` — keyword; case-insensitive match on title, url, notes, tag names (FR-011).
- `tag` — restrict to bookmarks carrying this tag name (FR-010).

**Response `200`**: `{ "bookmarks": [ <Bookmark>, ... ] }` (empty array is valid and
drives the empty/no-results states, FR-012).

## POST /api/bookmarks

Create a bookmark (FR-001).

**Request body**:

```json
{ "url": "example.com", "title": "Example", "notes": "", "tags": ["reading"] }
```

- `url` required; `title`, `notes`, `tags` optional.
- Server normalizes scheme-less urls to `https://` and validates (FR-002, FR-003).

**Responses**:

- `201`: `{ "bookmark": <Bookmark> }` — created.
- `201` with `{ "bookmark": <Bookmark>, "warning": "duplicate_url" }` — created but an
  identical url already existed (FR-013); creation is not blocked.
- `400`: `{ "error": "Invalid URL" }` — url missing or not parseable (FR-002).

## PUT /api/bookmarks/:id

Update a bookmark's title, url, notes, and/or tags (FR-007). Same validation and
normalization as create. Refreshes `dateUpdated`.

**Responses**:

- `200`: `{ "bookmark": <Bookmark> }`.
- `400`: `{ "error": "Invalid URL" }`.
- `404`: `{ "error": "Bookmark not found" }`.

## DELETE /api/bookmarks/:id

Delete a bookmark (FR-008). Confirmation is a client-side responsibility; the API
performs the permanent removal and cascades tag links.

**Responses**:

- `204`: no body — deleted.
- `404`: `{ "error": "Bookmark not found" }`.

## GET /api/tags

List distinct tag names in use (supports the tag filter UI, FR-010).

**Response `200`**: `{ "tags": ["reading", "reference"] }`.

## Notes

- Opening a bookmark (FR-006) is a pure client action (open `url` in a new tab); it
  requires no API call.
- All write endpoints re-validate on the server so the contract cannot be bypassed by
  the client.
