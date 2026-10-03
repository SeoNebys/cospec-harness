# API Contract: Bookmark Manager

A JSON REST API served by the same Node process that serves the front end. All
request/response bodies are JSON. Timestamps are ISO-8601 UTC. This contract maps
directly to the functional requirements in [spec.md](../spec.md).

Base path: `/api`

## Data shapes

### Bookmark (response)

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "Example Article",
  "note": "read later",
  "tags": ["reading", "reference"],
  "createdAt": "2026-09-24T10:00:00Z",
  "updatedAt": "2026-09-24T10:00:00Z"
}
```

## Endpoints

### GET /api/bookmarks

List bookmarks (FR-005), with optional search and tag filter.

**Query params** (all optional):

- `q` — keyword; matches title, url, or tag name (FR-006).
- `tag` — restrict to bookmarks carrying this tag (FR-010).

**200 Response**:

```json
{ "bookmarks": [ /* Bookmark, newest first */ ] }
```

- No matches returns `{ "bookmarks": [] }` (empty state, not an error — FR-011).

### POST /api/bookmarks

Create a bookmark (FR-001, FR-002, FR-003, FR-012).

**Request body**:

```json
{
  "url": "example.com/article",
  "title": "",
  "note": "read later",
  "tags": ["reading"]
}
```

- `url` required; `title`, `note`, `tags` optional.
- `url` is normalized (assume `https://` if no scheme).
- If `title` is empty, it is derived (page title if reachable, else host/path).

**201 Response**:

```json
{ "bookmark": { /* Bookmark */ }, "warnings": ["duplicate_url"] }
```

- `warnings` is present only when relevant; `duplicate_url` indicates an existing
  bookmark shares the normalized url (save still succeeded — FR-012).

**400 Response** (validation failure — FR-002, FR-011):

```json
{ "error": { "code": "invalid_url", "message": "Enter a valid web address." } }
```

### GET /api/bookmarks/{id}

Fetch a single bookmark.

- **200**: `{ "bookmark": { /* Bookmark */ } }`
- **404**: `{ "error": { "code": "not_found", "message": "Bookmark not found." } }`

### PUT /api/bookmarks/{id}

Update a bookmark's title, note, and/or tags (FR-007).

**Request body** (fields optional; provided fields replace existing values):

```json
{ "title": "New title", "note": "updated", "tags": ["reading", "done"] }
```

- Editing the `url` is out of scope for v1 (not in FR-007); only title, note, tags.
- Empty `title` is rejected (title must remain non-empty).

**Responses**:

- **200**: `{ "bookmark": { /* updated Bookmark */ } }`
- **400**: validation error (same shape as POST).
- **404**: not found.

### DELETE /api/bookmarks/{id}

Delete a bookmark (FR-008). Deletion confirmation is enforced in the UI before this
call is made.

- **204**: no content (deleted).
- **404**: `{ "error": { "code": "not_found", "message": "Bookmark not found." } }`

## Error format

All errors use:

```json
{ "error": { "code": "<machine_code>", "message": "<user-friendly text>" } }
```

Defined codes: `invalid_url`, `invalid_title`, `not_found`.

## Front-end contract (UI)

- On initial load, after the bookmark list (or a valid empty state) has rendered,
  the app sets `data-harness-ready="true"` on a visible root element.
- Delete requires an explicit confirmation step in the UI before calling DELETE
  (FR-008).
- Validation errors and empty search/filter results are shown as friendly inline
  messages, never as raw errors (FR-011).
- Each listed bookmark exposes an action to open its original page (FR-009).
