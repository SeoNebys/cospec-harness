# API Contract: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-24

A same-origin JSON REST API served alongside the static frontend on port 4000.
All request and response bodies are `application/json`. Timestamps are ISO-8601
UTC strings. This contract is the agreement the frontend and tests rely on;
implementation details live in `tasks.md` / the implementation phase.

## Resource: Bookmark (representation)

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "A good article",
  "tags": ["reading", "tech"],
  "created_at": "2026-09-24T10:15:30.000Z",
  "updated_at": "2026-09-24T10:15:30.000Z"
}
```

## Endpoints

### GET /api/bookmarks

List bookmarks, newest first (FR-005), with optional filtering.

- **Query parameters** (all optional):
  - `q` — case-insensitive substring matched against title and url (FR-011).
  - `tag` — return only bookmarks carrying this exact (normalized) tag (FR-010).
  - `q` and `tag` combine with AND.
- **200 OK**:
  ```json
  { "bookmarks": [ { /* bookmark */ } ], "total": 1 }
  ```
- Empty collection and empty filtered result both return `200` with an empty
  array; the client distinguishes them using the unfiltered total (FR-012).

### GET /api/tags

List distinct tags across all bookmarks, for the filter control (FR-010).

- **200 OK**:
  ```json
  { "tags": ["reading", "tech"] }
  ```

### POST /api/bookmarks

Create a bookmark (FR-001).

- **Request body**:
  ```json
  { "url": "example.com", "title": "", "tags": ["Tech", "tech "] }
  ```
  - `url` required; `title` optional (defaults per VR-3); `tags` optional array
    (normalized per VR-4).
- **201 Created**: the created bookmark. When the normalized URL already exists,
  the save still succeeds and includes a non-blocking warning (FR-013):
  ```json
  { "bookmark": { /* bookmark */ }, "warning": "duplicate_url" }
  ```
  The `warning` field is omitted when there is no duplicate.
- **400 Bad Request** (validation failure, FR-002):
  ```json
  { "error": "invalid_url", "message": "Enter a valid web address." }
  ```

### PUT /api/bookmarks/{id}

Update an existing bookmark's title, url, and/or tags (FR-007).

- **Request body**: any of `url`, `title`, `tags`. Provided fields are validated
  and normalized with the same rules as create.
- **200 OK**: the updated bookmark (with refreshed `updated_at`).
- **400 Bad Request**: `invalid_url` as above.
- **404 Not Found**:
  ```json
  { "error": "not_found", "message": "Bookmark does not exist." }
  ```

### DELETE /api/bookmarks/{id}

Delete a bookmark permanently (FR-008; the confirmation step is a UI concern).

- **204 No Content** on success.
- **404 Not Found**: as above.

## Cross-cutting

- **Validation** is authoritative on the server; the client mirrors it for fast
  feedback only.
- **Security headers**: responses set a restrictive `Content-Security-Policy`;
  user content is never interpolated into HTML (FR-014).
- **Errors** use the shape `{ "error": <code>, "message": <human text> }` with
  codes `invalid_url`, `not_found` (extendable).
- **Ordering** for list responses is `created_at DESC` unless a future sort
  parameter is added.
