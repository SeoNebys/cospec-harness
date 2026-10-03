# Contract: HTTP API

JSON over HTTP. Base path `/api`. The same Express process also serves the built
frontend and, at `/snapshots/...`, the stored snapshot/preview/favicon files. All
request bodies and responses are JSON unless noted. Errors use a consistent shape:

```json
{ "error": { "code": "string", "message": "human-readable" } }
```

Common error codes: `invalid_url`, `duplicate` (with `existingId`), `invalid_query`,
`not_found`, `validation_error`.

## Bookmarks

### POST /api/bookmarks
Create (save) a bookmark. Body: `{ "url": "...", "title?": "...", "tags?": [..],
"note?": "..." }`.
- `201` → the created bookmark (enrichment/snapshot start in background:
  `snapshot_status: "pending"`). `is_unread` is `false` (FR-023).
- `409 duplicate` with `{ "error": { "code": "duplicate", ... }, "existingId": N }`
  when `url_key` already exists — the client navigates to the existing bookmark
  (FR-006).
- `400 invalid_url` when the address is malformed (FR-002).

### GET /api/bookmarks
List/search active (non-archived) bookmarks. Query params:
- `q` — search query (see `search-grammar.md`); `400 invalid_query` if malformed.
- `includeTags`, `excludeTags` — comma-separated tag filters (FR-022).
- `unread=true` — restrict to unread (unread view, FR-025).
- `sort` — `created_desc|created_asc|title_asc|title_desc` (FR-011); defaults to the
  user's preference (FR-042).
- `page`, `pageSize` — pagination; `pageSize` defaults to the preference.
- Response: `{ "items": [Bookmark...], "total": N }`. Archived rows excluded (FR-019).

### GET /api/bookmarks/archived
List archived bookmarks (archive view, FR-030). Same shape as above.

### GET /api/bookmarks/:id
Fetch one bookmark (detail/edit).

### PATCH /api/bookmarks/:id
Edit fields: any of `url`, `title`, `description`, `tags`, `note` (FR-004).
- Editing `url` re-validates and re-checks duplicates: `400 invalid_url` /
  `409 duplicate` as on create.
- `200` → updated bookmark.

### DELETE /api/bookmarks/:id
Permanently delete (FR-032). Cascades tags/link rows and snapshot files. `204`.

### POST /api/bookmarks/:id/read-state
Body `{ "unread": true|false }` — mark read/unread (FR-024). `200`.

### POST /api/bookmarks/:id/archive  ·  POST /api/bookmarks/:id/restore
Archive / restore (FR-029, FR-031). `200`.

### POST /api/bookmarks/:id/archive-org
Request Internet Archive preservation (FR-040). Returns immediately with
`archive_org_status: "pending"`; the final outcome updates the bookmark to `ready`
(with `archive_org_url`) or `failed`. A `failed` outcome MUST be visibly surfaced in
the UI (not a silent no-op) and does not affect the local bookmark save (FR-041).

## Bulk & view-wide actions

### POST /api/bookmarks/bulk
Body:
```json
{
  "target": { "ids": [1,2,3] }            // explicit selection
            | { "filter": { "q": "...", "includeTags": [], "excludeTags": [], "unread": false, "archived": false } },
  "action": "addTags" | "removeTags" | "markRead" | "markUnread" | "archive" | "delete",
  "tags": ["..."]                          // required for addTags/removeTags (FR-026a)
}
```
- `target.ids` applies to the selection; `target.filter` applies to every bookmark in
  the current filtered view (FR-027).
- `addTags`/`removeTags` add or remove the given tags across the target (FR-026a).
- `delete` requires the client to have confirmed (FR-028); server performs the delete.
- `200` → `{ "affected": N }`.

## Tags

### GET /api/tags?prefix=...
List tags, optionally filtered by prefix for type-ahead suggestions (FR-021).
Response: `[{ "id", "name", "count" }...]`.

## Saved views

### GET /api/views  ·  POST /api/views  ·  PATCH /api/views/:id  ·  DELETE /api/views/:id
CRUD for saved views (FR-033, FR-034). A view stores `name`, `query`,
`includeTags`, `excludeTags`, optional `sort`. Opening a view = calling
`GET /api/bookmarks` with the view's parameters.

## Import / Export

### POST /api/import
Multipart upload of a Netscape bookmark HTML file (FR-035). Parses titles, tags
(from folders/tags), and original dates; skips addresses already present by
normalized key (FR-036). Response: `{ "imported": N, "skipped": N }`.

### GET /api/export
Returns a Netscape bookmark HTML file (attachment) preserving titles, tags, and
original dates (FR-037).

## Preferences

### GET /api/preferences  ·  PUT /api/preferences
Read/update `default_sort`, `items_per_page`, `font_size` (FR-042); persisted
(FR-043).

## Static / snapshot serving

- `GET /snapshots/:id/...` — serves a bookmark's stored snapshot (HTML or PDF),
  favicon, and preview image files.
- `GET /` and other non-`/api` routes serve the built SPA.

## Bookmark response shape

```json
{
  "id": 1,
  "url": "https://example.com/article",
  "title": "…", "description": "…",
  "note": "# markdown…",
  "faviconUrl": "/snapshots/1/favicon.ico",
  "previewUrl": "/snapshots/1/preview.png",
  "snapshot": { "kind": "html|pdf|null", "status": "pending|ready|failed", "url": "/snapshots/1/page.html" },
  // snapshot.kind "html" = self-contained single file usable offline; "pdf" = original PDF.
  // snapshot.status "failed" is surfaced in the UI (FR-041).
  "archiveOrg": { "status": "none|pending|ready|failed", "url": null },
  // archiveOrg.status "failed" is surfaced in the UI (FR-041).
  "tags": ["work", "reading"],
  "isUnread": false,
  "isArchived": false,
  "createdAt": "2026-09-18T10:00:00Z",
  "updatedAt": "2026-09-18T10:00:00Z"
}
```
