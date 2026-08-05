# Phase 1 Contract: Local HTTP/JSON API

The local server exposes this small JSON API to the browser UI on `localhost`.
All endpoints are local-only (single user, no authentication). Requests and
responses are JSON. Timestamps are ISO-8601. Traceability to functional
requirements is noted per endpoint.

## Bookmark object (response shape)

```json
{
  "id": 1,
  "url": "https://example.com/page",
  "title": "Example Page",
  "description": "",
  "tags": ["reading", "work"],
  "createdAt": "2026-07-14T10:00:00Z",
  "updatedAt": "2026-07-14T10:00:00Z"
}
```

## Endpoints

### `GET /api/bookmarks`  — list / search / filter (FR-006, FR-007, FR-010)

Query params (all optional):

- `q` — keyword; matches title, url, and tag names.
- `tag` — restrict to bookmarks carrying this tag name.
- `sort` — `created_desc` (default) | `created_asc` | `title_asc`.

Returns `200` with `{ "bookmarks": [ <Bookmark>, ... ] }`. Excludes soft-deleted
bookmarks. An empty array is a valid result (drives the no-results state, FR-015).

### `POST /api/bookmarks`  — save (FR-001, FR-002, FR-003, FR-004, FR-014)

Request:

```json
{ "url": "https://example.com", "title": "", "description": "", "tags": ["work"] }
```

- `url` required. `title`, `description`, `tags` optional.
- If `url` is not a well-formed `http`/`https` address → `400` with
  `{ "error": "invalid_url", "message": "<explanation of a valid address>" }`
  (FR-002).
- If `title` omitted/empty → server derives it from the page, falling back to the
  url when unreachable (FR-003).
- If the normalized url matches an existing active bookmark → `409` with
  `{ "error": "duplicate", "message": "...", "existing": <Bookmark> }` so the UI
  can offer to open the existing one (FR-014, SC-006).
- On success → `201` with the created `<Bookmark>`.

### `GET /api/bookmarks/{id}`  — detail

Returns `200` with the `<Bookmark>` (full, untruncated fields — supports the
long-title/long-url edge case), or `404` if not found / soft-deleted.

### `PATCH /api/bookmarks/{id}`  — edit (FR-011)

Request may include any of `url`, `title`, `description`, `tags`.

- Same url validation and duplicate rules as create when `url` changes.
- Updates `updatedAt`.
- Returns `200` with the updated `<Bookmark>`, or `404` if not found.

### `DELETE /api/bookmarks/{id}`  — delete (FR-012)

Soft-deletes the bookmark. Returns `200` with
`{ "id": <id>, "undoToken": "<token>" }`. The confirmation step itself is a UI
responsibility; this endpoint performs the removal.

### `POST /api/bookmarks/{id}/undo`  — undo delete (FR-013)

Restores a just-deleted bookmark (by `id` or `undoToken`). Returns `200` with the
restored `<Bookmark>`, or `410` if it is no longer restorable.

### `GET /api/tags`  — list tags (FR-009, FR-010)

Returns `200` with `{ "tags": [ { "id": 1, "name": "work", "count": 12 }, ... ] }`
where `count` is the number of active bookmarks carrying the tag (drives filters).

### `PATCH /api/tags/{id}`  — rename tag (FR-009)

Request `{ "name": "new-name" }`. Rename propagates to every bookmark carrying the
tag. Merges into an existing tag if the new name already exists
(case-insensitive). Returns `200` with the updated tag.

### `DELETE /api/tags/{id}`  — remove tag (FR-009)

Removes the tag from all bookmarks that carry it. Returns `200`.

## Error format

All errors use `{ "error": "<machine_code>", "message": "<human message>" }` with
an appropriate HTTP status, so the UI can show helpful, specific guidance
(FR-002, FR-015).
