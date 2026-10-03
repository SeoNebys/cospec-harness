# API Contract: Bookmark Manager

A single-origin JSON API served by the same process that serves the UI. All request
and response bodies are JSON. All timestamps are UTC ISO-8601 strings.

## Resource shape: Bookmark

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "Example Article",
  "notes": "read later",
  "tags": ["reading", "tech"],
  "created_at": "2026-09-24T10:15:00Z",
  "updated_at": "2026-09-24T10:15:00Z"
}
```

## GET /api/bookmarks

List bookmarks, newest first. Supports optional filtering. (FR-006, FR-011, FR-012, FR-013)

**Query parameters** (all optional):
- `q` — search term matched against title, url, notes, and tags.
- `tag` — restrict to bookmarks carrying this tag name.

**200 Response**:
```json
{
  "bookmarks": [ /* Bookmark objects */ ],
  "total": 42,          // total saved bookmarks, ignoring filters
  "matched": 3          // number returned after applying q/tag
}
```
`total` vs `matched` lets the UI show the empty state (`total === 0`) distinctly from
the no-results state (`total > 0 && matched === 0`).

## POST /api/bookmarks

Create a bookmark. (FR-001, FR-002, FR-003, FR-004, FR-010, FR-014)

**Request body**:
```json
{
  "url": "example.com/article",   // required; normalised server-side
  "title": "",                     // optional; auto-filled if blank
  "notes": "",                     // optional
  "tags": ["reading"],             // optional
  "confirmDuplicate": false        // optional; must be true to save a known duplicate
}
```

**Responses**:
- `201 Created` → the created Bookmark object.
- `400 Bad Request` → invalid/missing address: `{ "error": "message" }` (FR-002).
- `409 Conflict` → address already exists and `confirmDuplicate` was not true:
  `{ "error": "already_saved", "message": "...", "existingId": 7 }` (FR-010). The
  client re-submits with `confirmDuplicate: true` to save anyway.

Server behaviour: normalises the address (adds `https://` if no scheme), validates it,
and if `title` is blank performs a best-effort page-title fetch with a short timeout,
falling back to the address. Failure to fetch never fails the request (FR-004).

## GET /api/bookmarks/:id

Fetch one bookmark. `200` → Bookmark object; `404` if not found.

## PUT /api/bookmarks/:id

Update title, url, notes, and/or tags of an existing bookmark. (FR-008)

**Request body**: any of `url`, `title`, `notes`, `tags`. `url` is re-validated and
re-normalised if provided. Updates `updated_at`.

**Responses**:
- `200 OK` → the updated Bookmark object.
- `400 Bad Request` → invalid address.
- `404 Not Found` → no such bookmark.

## DELETE /api/bookmarks/:id

Permanently delete a bookmark. (FR-009)

**Responses**:
- `204 No Content` → deleted.
- `404 Not Found` → no such bookmark.

The confirmation step required by FR-009 is enforced in the UI before this call is
made; the endpoint itself performs the permanent removal.

## GET /api/tags

List existing tag names (for the tag-filter control). (FR-012)

**200 Response**: `{ "tags": ["reading", "tech", ...] }`

## Error format

All error responses use `{ "error": "<code>", "message": "<human-readable>" }` and an
appropriate HTTP status. Messages are user-actionable (SC-005).
