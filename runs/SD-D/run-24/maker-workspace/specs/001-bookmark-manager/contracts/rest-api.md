# Contract: REST API

Base path: `/api`. JSON request/response bodies. All endpoints are single-user
(no auth in v1). Errors use `{ "error": { "code", "message", "details?" } }` with
appropriate HTTP status. Validation via Zod; malformed input → `400`.

## Bookmarks

### POST /api/bookmarks
Create (or resolve duplicate). Body: `{ url, title?, description?, tags?[],
note_markdown?, read? }`.
- `201` with the created bookmark when new.
- `200` with `{ bookmark, duplicate: true }` when `normalized_url` already exists
  — the client opens it for editing (FR-006). No duplicate is created.
- `400` when `url` is not a well-formed web address (FR-002).
- Side effects (best-effort, non-blocking): fetch metadata to fill missing
  title/description/icon/preview (FR-003/005); start local-copy capture and
  Wayback lookup (FR-025/027). Capture/metadata failure never fails the request.

### GET /api/bookmarks
List with search, filter, sort, paging.
Query params:
- `q` — rich search expression (see `search-grammar.md`).
- `tag` — quick single-tag filter (FR-015).
- `filterId` — apply a saved filter (FR-016).
- `view` — `all` (default), `readlater` (`read=0`), `archive` (`archived=1`).
- `sort` — `saved_desc|saved_asc|title_asc|title_desc|updated_desc`.
- `page`, `pageSize`.
Response: `{ items: Bookmark[], total, page, pageSize }`. Archived items excluded
unless `view=archive` (FR-019). Malformed `q` → `400` with a clear message
(FR-012).

### GET /api/bookmarks/:id
Return one bookmark with tags and preserved-copy status.

### PATCH /api/bookmarks/:id
Update any of `{ url, title, description, tags[], note_markdown, read, archived }`
(FR-023). Editing `url` recomputes `normalized_url` (409 if it collides with a
different bookmark). Sets `updated_at`.

### DELETE /api/bookmarks/:id
Permanent delete (distinct from archive). `204`. UI confirms first (FR-024).

### GET /api/bookmarks/:id/copy
Serve the preserved local copy (`.mhtml` or original `.pdf`) with the correct
content type, or `404` when `status != available` (FR-025/026/028).

### POST /api/bookmarks/:id/archive-copy/refresh
Re-query Internet Archive; if no snapshot, request one be saved. Returns updated
`{ wayback_url|null, requested }` (FR-027). Best-effort; `503` semantics reported
in body when the service is unreachable.

## Bulk actions

### POST /api/bookmarks/bulk
Body: `{ target, action, payload? }`.
- `target`: `{ ids: number[] }` **or** `{ allMatching: { q?, tag?, filterId?,
  view? } }` — the latter re-evaluates the current search/filter server-side and
  affects every match, excluding archived unless `view=archive` (FR-021, SC-006).
- `action`: `addTags` | `removeTags` (payload `{ tags[] }`), `markRead` |
  `markReadLater`, `archive` | `restore`, `delete`.
- Response: `{ affected: number }`. Bulk delete requires `confirm: true`
  (FR-022).

## Tags

### GET /api/tags?query=
List tags; with `query`, return suggestions matching typed text for reuse
(FR-015a).

### DELETE /api/tags/:id
Remove a tag (also detaches it from bookmarks).

## Saved filters

### GET /api/filters — list saved filters.
### POST /api/filters — create `{ name, search_expression?, includedTagIds[],
excludedTagIds[] }` (FR-016).
### PATCH /api/filters/:id — edit.
### DELETE /api/filters/:id — remove.

## Import / export

### POST /api/import
Multipart upload of a Netscape bookmark HTML file. Parses `HREF`, `ADD_DATE`,
`TAGS`. Merges non-destructively by `normalized_url` (union tags, earliest date,
preserve existing fields, fill empties) (FR-029/031, Q3). Response:
`{ imported, merged, skippedInvalid }`.

### GET /api/export
Returns a Netscape bookmark HTML file (`text/html` download) with
`TAGS="tag1,tag2"` on each entry, preserving titles and saved dates
(FR-030, Q5).

## Preferences

### GET /api/preferences — current display preferences.
### PUT /api/preferences — update `{ default_sort, page_size, text_size }`
(FR-033).

## Health / readiness

### GET /api/health
`200 { status: "ok" }` once the DB is migrated and ready. The SPA sets
`data-harness-ready="true"` after its initial list (or empty state) has loaded.

## Bookmark shape (response)

```jsonc
{
  "id": 1,
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "…",
  "iconUrl": "/api/bookmarks/1/icon",      // or null
  "previewImageUrl": "/api/bookmarks/1/preview", // or null
  "note_markdown": "…",
  "tags": ["reading", "tech"],
  "read": true,
  "archived": false,
  "saved_at": "2026-09-25T10:00:00Z",
  "updated_at": "2026-09-25T10:00:00Z",
  "copy": { "type": "mhtml", "status": "available", "wayback_url": "https://web.archive.org/…|null" }
}
```
