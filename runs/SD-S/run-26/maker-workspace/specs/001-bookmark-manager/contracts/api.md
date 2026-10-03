# API Contract: Bookmark Manager

REST API served by the Node/Express app under `/api/*`. JSON request/response
unless noted. Single-user; no authentication. All responses use standard HTTP
status codes; errors return `{ "error": "<message>" }`.

## Bookmark object (response shape)

```json
{
  "id": 1,
  "address": "https://example.com/article",
  "title": "Example Article",
  "description": "A short summary…",
  "faviconUrl": "/assets/favicons/1.ico",
  "previewImageUrl": "/assets/thumbnails/1.png",
  "notes": "why I saved this",
  "status": "unread",
  "archived": false,
  "snapshotAvailable": true,
  "snapshotType": "webpage",
  "snapshotUrl": "/api/bookmarks/1/snapshot",
  "tags": ["reading", "tech"],
  "createdAt": "2026-09-26T10:00:00.000Z",
  "updatedAt": "2026-09-26T10:00:00.000Z"
}
```

## Endpoints

### List / search / filter / sort
`GET /api/bookmarks`

Query params (all optional):
- `view` = `all` (default) | `unread` | `archive` — selects scope (FR-014/FR-016/FR-023).
- `q` = keyword; matches title, address, description, notes, tags (FR-011).
- `tag` = tag name to filter by (FR-012).
- `sort` = `created` (default) | `title` (FR-013).
- `order` = `desc` (default) | `asc`.

Response `200`: `{ "bookmarks": [ <Bookmark>… ], "count": <n> }`. Empty scopes
return an empty array (UI renders the empty state).

### Create (with duplicate-to-edit behavior)
`POST /api/bookmarks`  body: `{ "address": "...", "title?": "...", "description?": "...", "notes?": "...", "tags?": ["..."] }`

- `201` + `<Bookmark>` when a new bookmark is created. Server auto-fetches
  title/description/favicon/preview and captures a snapshot before responding
  (FR-003/FR-006); missing details or snapshot fall back gracefully
  (FR-005/FR-008) and are reflected in the returned object.
- `200` + `{ "duplicate": true, "bookmark": <Bookmark> }` when `address`
  normalizes to an existing bookmark (active or archived) — the client opens it
  for editing instead of creating a copy (FR-018).
- `400` + `{ "error": "..." }` when `address` is not a well-formed web address;
  nothing is saved (FR-002).

### Retrieve
`GET /api/bookmarks/:id` → `200` `<Bookmark>` | `404`.

### Update (edit title/description/notes/tags/status)
`PATCH /api/bookmarks/:id` body: any of `{ "title", "description", "notes", "tags", "status" }`

- `200` `<Bookmark>` with `updatedAt` refreshed. `status` accepts `read`|`unread`
  (FR-014). `tags` replaces the tag set (FR-015/FR-008 editing). `404` if missing.

### Archive / restore
`POST /api/bookmarks/:id/archive` → `200` `<Bookmark>` (`archived: true`) (FR-016).
`POST /api/bookmarks/:id/restore` → `200` `<Bookmark>` (`archived: false`) (FR-016).

### Delete (permanent)
`DELETE /api/bookmarks/:id` → `204`. Permanently removes the record and its stored
snapshot/thumbnail/favicon files (FR-017). Separate from archive; the UI requires
an explicit confirmation before calling this.

### Snapshot / assets
`GET /api/bookmarks/:id/snapshot` → serves the stored snapshot with the correct
content type: `multipart/related` (MHTML) for `webpage`, `application/pdf` for
`pdf` (FR-006/FR-007). `404` if `snapshotAvailable` is false.
Favicon and thumbnail image files are served as static assets at the URLs given in
the bookmark object.

### Import
`POST /api/import` — multipart upload of a Netscape bookmark HTML file.
- `200` `{ "imported": <n>, "skippedDuplicates": <n>, "invalid": <n> }`. Valid
  entries are added, folders mapped to tags, existing addresses not duplicated;
  invalid entries skipped and counted (FR-020/FR-022).

### Export
`GET /api/export` → `200` a Netscape bookmark HTML file
(`Content-Disposition: attachment`) containing the current collection, re-importable
without duplication (FR-021/SC-008).

## Notes

- Opening a bookmarked address in the browser (FR-019) is a client action using
  the `address` field (new tab); no dedicated endpoint required.
- Save is synchronous through detail-fetch + snapshot so the created bookmark is
  fully populated when listed (SC-001/SC-002/SC-004).
