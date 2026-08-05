# API Contract: Bookmark Manager

The backend exposes a small HTTP/JSON API consumed by the frontend. This contract
lists the endpoints, their inputs, and their outcomes at a behavioural level. It
maps each endpoint to the functional requirements it satisfies. Field shapes come
from [data-model.md](../data-model.md).

Base path: `/api`. All request/response bodies are JSON.

## Bookmarks

### POST /api/bookmarks — Create a bookmark
Satisfies FR-001, FR-002, FR-012, FR-014, FR-016, FR-017.

- **Body**: `{ url (required), title?, note?, tags?: string[], allowDuplicate?: boolean }`
- **Behaviour**:
  - Rejects a malformed `url` → `400` with a clear message (FR-002).
  - If `normalized_url` matches an existing bookmark and `allowDuplicate` is not true → `409` with a duplicate warning payload including the existing bookmark (FR-012). Client may resubmit with `allowDuplicate: true`.
  - Otherwise persists immediately with `fetch_status: pending` and returns `201` with the created bookmark — **without waiting** for metadata (FR-017, SC-007).
  - Metadata enrichment runs asynchronously; the record's `title`/`preview_*`/`fetch_status` update when it finishes (FR-014, FR-016).
- **Returns**: `201` `{ bookmark }`.

### GET /api/bookmarks — List / search / filter
Satisfies FR-005, FR-006, FR-007, FR-009.

- **Query params**: `q?` (search term), `tag?` (tag name filter), pagination params optional.
- **Behaviour**:
  - No params → all bookmarks, newest first (FR-005).
  - `q` → only bookmarks matching the term in title/url/note (FR-006); empty match returns an empty list the client renders as "no results" (FR-007).
  - `tag` → only bookmarks carrying that tag (FR-009).
  - `q` and `tag` may combine.
- **Returns**: `200` `{ bookmarks: [...] }`.

### GET /api/bookmarks/:id — Read one
Supports the detail view and post-enrichment polling/refresh.
- **Returns**: `200` `{ bookmark }` or `404`.

### PATCH /api/bookmarks/:id — Edit
Satisfies FR-010, FR-015.
- **Body**: any of `{ title?, note?, tags?: string[] }`.
- **Behaviour**: updates the given fields; a user-set `title` takes precedence over any fetched value (FR-015); changes persist (FR-010).
- **Returns**: `200` `{ bookmark }` or `404`.

### DELETE /api/bookmarks/:id — Delete
Satisfies FR-011.
- **Behaviour**: removes the bookmark. Confirmation is enforced in the UI before this call is made (FR-011); the endpoint performs the deletion.
- **Returns**: `204` or `404`.

## Tags

### GET /api/tags — List all tags
Supports the tag filter UI and existing-tag picker.
- **Returns**: `200` `{ tags: [...] }` (optionally with per-tag bookmark counts).

### Tag assignment
Satisfies FR-008. Tags are managed through the bookmark create/edit `tags` field:
supplying a `tags` array adds/replaces the bookmark's tags; omitting a tag on edit
removes it from that bookmark only (data-model relationship rules). New tag names
are created on first use and normalized (research §6).

## Error format

All errors return a consistent JSON shape: `{ error: { code, message } }` with an
appropriate HTTP status, so the client can show clear, user-friendly messages
(FR-002, FR-007, FR-012).

## Requirement coverage map

| FR | Endpoint(s) |
|----|-------------|
| FR-001 create | POST /api/bookmarks |
| FR-002 validate url | POST /api/bookmarks (400) |
| FR-003 fallback label | display rule (GET responses carry url) |
| FR-004 persistence | all (SQLite-backed) |
| FR-005 newest-first list | GET /api/bookmarks |
| FR-006 search | GET /api/bookmarks?q= |
| FR-007 no-results / empty | GET /api/bookmarks (empty list) |
| FR-008 tags add/remove | POST + PATCH `tags` |
| FR-009 filter by tag | GET /api/bookmarks?tag= |
| FR-010 edit | PATCH /api/bookmarks/:id |
| FR-011 delete (confirmed) | DELETE /api/bookmarks/:id |
| FR-012 duplicate warning | POST /api/bookmarks (409) |
| FR-013 date added | POST sets created_at; carried in responses |
| FR-014 auto-fetch metadata | POST triggers async enrichment |
| FR-015 edit fetched title | PATCH title precedence |
| FR-016 graceful fetch fail | fetch_status: failed + fallback |
| FR-017 non-blocking save | POST returns before fetch completes |
