# API Contract: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16
Local JSON API served by the Node process under `/api` on `0.0.0.0:4000`. No
authentication (single-user, same-device). All request/response bodies are JSON
unless noted (import upload and snapshot/export downloads are binary/HTML).
Errors use `{ "error": { "code": string, "message": string } }` with an
appropriate HTTP status.

Common `Bookmark` shape returned by endpoints:

```json
{
  "id": 1,
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "…",
  "favicon": "/api/bookmarks/1/favicon",
  "preview": "/api/bookmarks/1/preview",
  "note_md": "## why I saved this",
  "read_state": "unread",
  "archived": false,
  "metadata_status": "complete",
  "tags": ["reading", "js"],
  "internet_archive_url": null,
  "snapshot": { "kind": "html", "url": "/api/bookmarks/1/snapshot" },
  "date_added": "2026-09-16T10:00:00Z",
  "date_updated": "2026-09-16T10:00:00Z"
}
```

## Bookmarks

### POST /api/bookmarks — save a bookmark (US1, FR-001–006)
Body: `{ "url": "...", "title?": "...", "description?": "...", "tags?": [..],
"note_md?": "..." }`.
- Validates + normalizes URL (FR-002/003). Invalid → `400 invalid_url`.
- If `url_key` already exists → **`200`** with `{ "duplicate": true, "bookmark":
  <existing> }` so the client opens it for editing (FR-006). No new row.
- Else creates with `metadata_status:"pending"` and returns **`201`** with the
  bookmark; metadata fetch runs asynchronously (FR-005).

### GET /api/bookmarks — list / search (US2, US4, FR-013,016,018–025)
Query params:
- `view` = `normal` (default) | `unread` | `archived` (FR-016). `normal` and
  `unread` exclude archived; `archived` shows only archived (FR-013/024).
- `q` = search expression (FR-018–024); empty = all in view.
- `tag` = convenience filter for click-to-filter (FR-015); equivalent to
  `#tag` in `q`.
- `sort` = one of the sort keys (FR-025); default from preferences.
- `page`, `pageSize` (pageSize default from preferences, FR-038).
Response: `{ "items": [Bookmark], "total": N, "page": P, "pageSize": S }`.
Invalid search expression → `400 invalid_query` with a human message (FR-022).

### GET /api/bookmarks/:id — fetch one (includes note, snapshot, tags).

### PATCH /api/bookmarks/:id — edit (US1/US3, FR-004,007,009,010)
Body may include any of: `url`, `title`, `description`, `tags`, `note_md`,
`read_state`, `archived`. `url` is re-normalized and re-checked for duplicates.
Tags resolve by shared identity (FR-008a). Returns the updated bookmark.

### DELETE /api/bookmarks/:id — permanent delete (US3, FR-011)
Hard-deletes the bookmark and cascades its tags-join + snapshot. `204`. Distinct
from archiving. (Client confirms first.)

### POST /api/bookmarks/bulk — bulk actions (US5, FR-026–028)
Body: `{ "action": "tag|untag|read|unread|archive|unarchive|delete",
"value?": "tagname", "select": { "ids": [..] } | { "matchView": "normal",
"q": "…" } }`.
- `select.ids` → act on those; `select.matchView`+`q` → act on **all** matching
  the current view/search including off-screen items (FR-027).
- `delete` requires `confirm: true`. Returns `{ "affected": N }` (FR-028).

### Favicon / preview / snapshot binaries
- `GET /api/bookmarks/:id/favicon` — cached favicon (or 302 to remote / placeholder).
- `GET /api/bookmarks/:id/preview` — cached preview image (or fallback).
- `POST /api/bookmarks/:id/snapshot` — capture (US7, FR-032). Detects PDF vs HTML;
  stores self-contained HTML or the original PDF. `201` with snapshot meta, or
  `502 snapshot_failed` (recoverable, FR-034).
- `GET /api/bookmarks/:id/snapshot` — serve stored snapshot for offline reopen
  (`text/html` self-contained, or `application/pdf`).

### POST /api/bookmarks/:id/archive-org — Internet Archive save (US7, FR-033/034)
Submits URL to Save Page Now; on success records + returns
`internet_archive_url`. On failure → `502 archive_unavailable` (recoverable,
retryable); bookmark unchanged.

## Tags

### GET /api/tags — list tags with counts (US3, FR-008/015/019)
`{ "items": [ { "name": "js", "count": 12 } ] }`. Powers tag suggestions,
click-to-filter, and the tag filter UI. `?prefix=` returns suggestions matching
a typed prefix (FR-008 suggestions).

## Saved searches (US6, FR-029–031)

- `GET /api/saved-searches` — list.
- `POST /api/saved-searches` — `{ name, query_text, include_tags[], exclude_tags[],
  view_scope, sort }`. Unique name.
- `PATCH /api/saved-searches/:id` — rename / update fields.
- `DELETE /api/saved-searches/:id`.
- `GET /api/saved-searches/:id/results` — convenience: runs the saved search and
  returns the same shape as `GET /api/bookmarks` (restores query + include/
  exclude tags + view + sort, FR-031).

## Preferences (US9, FR-038)

- `GET /api/preferences` → `{ default_sort, items_per_page, font_size }`.
- `PATCH /api/preferences` → validates + persists; returns updated prefs.

## Import / export (US8, FR-035–037)

- `POST /api/import` — multipart upload of a Netscape bookmark file. Parses
  address/title/tags/date-added (see [netscape-format.md](./netscape-format.md)),
  de-duplicates by `url_key`, imports nothing on a malformed file
  (`400 invalid_bookmark_file`, FR-037). Returns `{ "imported": N, "skipped": M }`.
- `GET /api/export` — returns a Netscape bookmark file
  (`text/html`, `Content-Disposition: attachment`) carrying address, title,
  tags, and date added (FR-036).

## Notes on async metadata

Clients create a bookmark (`metadata_status:"pending"`), show a spinner, and
either poll `GET /api/bookmarks/:id` or refetch the list until status is
`complete`/`failed`. Keeps saving non-blocking (FR-005 edge case).

**User-input safeguard (R13, FR-004)**: a `title`/`description` provided on
`POST` or changed via `PATCH` marks that field user-set. The asynchronous
metadata fill writes `title`/`description` **only for fields not marked user-set**
(conditional update), so delayed details never overwrite what the user typed or
edited — even if the edit happened while the fetch was still in flight. Favicon
and preview always fill.
