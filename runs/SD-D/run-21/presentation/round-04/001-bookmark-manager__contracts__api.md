# API Contract: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-25 | **Phase**: 1

REST API served by the Express backend under `/api`. JSON request/response
bodies. Single-user, no authentication (v1). All list endpoints operate over the
current state view unless a query/filter is supplied. Errors return an
appropriate 4xx/5xx status with `{ "error": "<message>" }`.

## Metadata & saving

### POST /api/metadata
Fetch page metadata for review before saving (FR-002).
- Body: `{ "url": string }`
- 200: `{ "url", "title", "description", "iconUrl", "previewImageUrl" }`
  (missing fields null when unavailable, best-effort; FR-004).
- 400: invalid/empty URL (FR-001).

### POST /api/bookmarks
Create a bookmark, or resolve to the existing one (FR-001, FR-015).
- Body: `{ "url", "title?", "description?", "noteHtml?", "tags?": string[],
  "iconUrl?", "previewImageUrl?" }`
- 201: created bookmark object.
- 200 + `{ "existing": true, "bookmark": {...} }`: URL already exists — client
  opens it for editing instead of duplicating (FR-015).
- 400: validation error.

## Reading, searching, sorting

### GET /api/bookmarks
List bookmarks (FR-005, FR-006, FR-007, FR-008, FR-009).
- Query params:
  - `state` = `active` (default) | `read_later` | `archived`
  - `q` = search query string (boolean language; FR-008/009)
  - `includeTags`, `excludeTags` = comma-separated tag names (FR-013)
  - `sort` = `newest` (default) | `oldest` | `title_az` | `title_za` |
    `recently_updated` (FR-007)
- 200: `{ "bookmarks": Bookmark[], "total": number }`.
- 400: malformed query (unbalanced quotes/parentheses) with a clear message
  (FR-009).

### GET /api/bookmarks/:id
- 200: bookmark object (including tags, capture/snapshot references).
- 404: not found.

### PATCH /api/bookmarks/:id
Edit fields including the address (FR-003, FR-010).
- Body: any of `{ "url", "title", "description", "noteHtml", "tags",
  "state", "isRead" }`.
- 200: updated bookmark. 400 on invalid URL; 409 if new `url` collides with a
  different existing bookmark.

### DELETE /api/bookmarks/:id
Permanent delete (FR-018). Confirmation is enforced by the UI.
- 204 on success.

## State & bulk actions

### POST /api/bookmarks/:id/state
Set state / read flag (FR-016, FR-017).
- Body: `{ "state?": "active"|"read_later"|"archived", "isRead?": boolean }`.
- 200: updated bookmark.

### POST /api/bookmarks/bulk
Apply one action to many bookmarks (FR-019, FR-020).
- Body:
  ```json
  {
    "select": { "ids": [1,2,3] }
      // OR select all matching current filter:
      // { "state": "active", "q": "...", "includeTags": [...], "excludeTags": [...] },
    "action": {
      "type": "addTags"|"removeTags"|"markRead"|"markUnread"|"archive"|"restore"|"delete",
      "tags": ["work"]   // for addTags/removeTags
    }
  }
  ```
- 200: `{ "affected": number }`. Delete requires the UI confirmation step.

## Tags

### GET /api/tags
- 200: `{ "tags": [{ "name", "count" }] }` — all tags with usage counts.

### GET /api/tags/suggest?prefix=...
Autocomplete existing tags while typing (FR-012).
- 200: `{ "tags": string[] }`.

## Saved views

### GET /api/views
- 200: `{ "views": SavedView[] }`.

### POST /api/views
Create a named view (FR-014).
- Body: `{ "name", "query?", "includedTags?": string[], "excludedTags?": string[] }`.
- 201: created view.

### PATCH /api/views/:id / DELETE /api/views/:id
Edit or delete a saved view (FR-014). Never alters underlying bookmarks.
- 200 / 204.

### GET /api/views/:id/results
Resolve a saved view live against the current collection (FR-014).
- Optional `sort` param. 200: `{ "bookmarks": Bookmark[], "total" }`.

## Import / export

### POST /api/import
Import a Netscape bookmark file (FR-021). `multipart/form-data` with the file,
or `{ "html": string }`.
- 200: `{ "added": number, "skipped": number }` (folders → tags; existing URLs
  skipped).
- 400: unreadable file (recognizable entries still imported where possible).

### GET /api/export
Export the collection as a Netscape bookmark file (FR-022).
- 200: `text/html` attachment that browsers and this app can re-import.

## Page preservation

### POST /api/bookmarks/:id/capture
Create a self-contained HTML capture, or preserve a PDF (FR-023).
- 202/200: `{ "capture": { "kind": "html"|"pdf", "status": "ready"|"failed" } }`.
- On failure: bookmark unaffected; `status: "failed"` and a message (FR-025).

### GET /api/bookmarks/:id/capture
Serve the stored capture (HTML or PDF) for viewing (FR-023).
- 200: the stored file with its content type. 404 if none.

### POST /api/bookmarks/:id/archiveorg
Request an Internet Archive snapshot (FR-024).
- 202: `{ "snapshot": { "status": "pending"|"ready"|"failed", "snapshotUrl?" } }`.
- On failure: bookmark unaffected; user informed (FR-025).

## Preferences

### GET /api/preferences
- 200: `{ "defaultSort", "density", "textSize" }` (FR-028).

### PUT /api/preferences
- Body: any of the three fields. 200: updated preferences (persisted; FR-028).

## Bookmark object (response shape)

```json
{
  "id": 1,
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "A short summary.",
  "noteHtml": "<p><strong>Read</strong> section 2.</p>",
  "iconUrl": "/api/bookmarks/1/icon",
  "previewImageUrl": "https://example.com/og.png",
  "state": "active",
  "isRead": false,
  "tags": ["work", "reference"],
  "capture": { "kind": "html", "status": "ready" },
  "archiveSnapshot": { "status": "ready", "snapshotUrl": "https://web.archive.org/..." },
  "createdAt": "2026-09-25T10:00:00Z",
  "updatedAt": "2026-09-25T10:00:00Z"
}
```
