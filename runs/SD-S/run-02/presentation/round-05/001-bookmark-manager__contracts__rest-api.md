# API Contract: Bookmark Manager REST API

Base path: `/api`. All request/response bodies are JSON. Single-user; no auth in
v1. The same server also serves the static frontend at `/`.

Conventions: timestamps are ISO-8601 strings. Errors return an appropriate HTTP
status with `{ "error": { "code": "<slug>", "message": "<human readable>" } }`.

## Bookmark resource shape

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "A short summary from the page.",
  "faviconUrl": "https://example.com/favicon.ico",
  "previewUrl": "https://example.com/og-image.png",
  "note": "Read later — relevant to project X",
  "tags": ["reading", "project-x"],
  "enrichmentStatus": "done",
  "createdAt": "2026-09-16T10:00:00Z",
  "updatedAt": "2026-09-16T10:00:05Z"
}
```

## Endpoints

### `GET /api/bookmarks`

List bookmarks, newest first (FR-005, FR-017).

Query parameters (all optional):
- `q` — keyword; case-insensitive substring match over title, url, description,
  note, and tag names (FR-016).
- `tag` — tag name; return only bookmarks carrying it (FR-016).

Response `200`: `{ "bookmarks": [ <Bookmark>, ... ] }`. Empty array when none
match (frontend renders empty/no-results state — FR-015).

### `POST /api/bookmarks`

Create a bookmark (FR-001). Body:

```json
{ "url": "https://example.com", "title": "optional", "note": "optional", "tags": ["optional"] }
```

- `201` with the created `<Bookmark>` (`enrichmentStatus` typically `pending`;
  enrichment completes shortly after — FR-007/FR-008). Save is not blocked by
  enrichment.
- `400` `invalid_url` — `url` missing or not a well-formed http/https URL
  (FR-002); nothing is created.
- `409` `duplicate` — normalized url already exists (FR-009). Body includes the
  existing bookmark so the client can route to edit:
  `{ "error": { "code": "duplicate", "message": "..." }, "existing": <Bookmark> }`.

### `GET /api/bookmarks/:id`

Fetch one bookmark (used to reflect enrichment results and to open edit view).
- `200` `<Bookmark>` · `404` `not_found`.

### `PATCH /api/bookmarks/:id`

Edit a bookmark (FR-012). Body may include any of: `url`, `title`,
`description`, `note`, `tags` (full replacement set of tag names). Provided
fields overwrite auto-filled values.
- `200` updated `<Bookmark>`.
- `400` `invalid_url` if a provided `url` is malformed.
- `409` `duplicate` if a changed `url` collides with a different bookmark.
- `404` `not_found`.

### `POST /api/bookmarks/:id/refresh`

Re-run best-effort enrichment for an existing bookmark (FR-013). Non-blocking;
does not overwrite fields the user has explicitly edited.
- `202` `{ "enrichmentStatus": "pending" }` · `404` `not_found`.

### `DELETE /api/bookmarks/:id`

Delete a bookmark (FR-014). The confirmation step is a frontend concern; this
endpoint performs the deletion.
- `204` no content · `404` `not_found`.

### `GET /api/tags`

List known tag names for suggestions and the filter UI (FR-011, FR-016).
Optional `prefix` query filters suggestions by what the user is typing.
- `200` `{ "tags": ["reading", "project-x", ...] }`.

## Non-functional notes

- Server binds `0.0.0.0:4000`, started via `npm start` (runtime env).
- Enrichment fetches are time-bounded and size-capped; failure yields
  `enrichmentStatus: "failed"` without failing the owning request.
- Search responses target <200ms for hundreds of bookmarks (SC-003, SC-005).
