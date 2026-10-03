# Contract: HTTP JSON API

Base path: `/api`. All request/response bodies are JSON unless noted. The same server also
serves the static SPA at `/`. Single user — no auth. Errors use appropriate HTTP status
codes with `{ "error": "message" }`.

## Bookmarks

### `GET /api/bookmarks`
List bookmarks. Query params:
- `view` = `all` (default, active only) | `unread` | `archive`
- `q` = search query string (see contracts/search-query.md)
- `tag` = filter to a single tag name (FR-013)
- `sort` = `date_added_desc` (default) | `date_added_asc` | `title_asc` | `title_desc` (FR-027)
- `page`, `page_size` (defaults from Preferences, FR-029)

Returns `{ items: Bookmark[], total: number }`. Archived bookmarks appear only for
`view=archive` (FR-024). `q` and `tag` combine conjunctively (FR-018). → FR-007, FR-010,
FR-013, FR-017–020, FR-022, FR-024, FR-027.

### `POST /api/bookmarks`
Create from `{ url, title?, tags?[] }`. Server normalizes the URL (FR-004), auto-captures
title/description/icon/preview (FR-002) with graceful fallback (FR-006). If `url` already
exists, responds `409` with `{ existingId }` so the client opens it for editing (FR-005).
Returns the created `Bookmark`. → FR-001–006, FR-011, FR-035.

### `GET /api/bookmarks/:id`
Return one bookmark with its tags and saved copies.

### `PATCH /api/bookmarks/:id`
Update any of `{ title, description, url, note, tags[] }`. Re-normalizes URL if changed;
updates `date_modified`. Note is Markdown source (FR-014). → FR-003, FR-008(edit), FR-015.

### `DELETE /api/bookmarks/:id`
Permanently delete (client confirms first). Cascades tags-join and saved copies. → FR-016.

### `POST /api/bookmarks/:id/read`  /  `POST /api/bookmarks/:id/unread`
Set read/unread status (FR-021).

### `POST /api/bookmarks/:id/archive`  /  `POST /api/bookmarks/:id/restore`
Archive (reversible) / restore (FR-023, FR-024).

## Saved copies

### `POST /api/bookmarks/:id/snapshot`
Create a saved local copy: self-contained HTML for a page, or store the PDF when the address
is a PDF (FR-030, FR-031). Returns the created `SavedCopy`.

### `POST /api/bookmarks/:id/archive-copy`
Request Internet Archive preservation (FR-032). On success returns a `SavedCopy` of kind
`internet_archive`; on external failure returns `502` with `{ error }` and leaves the
bookmark untouched.

### `GET /api/saved-copies/:id/content`
Serve a stored snapshot (HTML) or PDF file for reopening. → FR-030/031.

## Bulk actions

### `POST /api/bookmarks/bulk`
Body `{ ids?: number[], selector?: { view, q, tag }, action, tag? }` where `action` ∈
`add_tag` | `remove_tag` | `mark_read` | `mark_unread` | `archive` | `delete`. Either an
explicit `ids` list or a `selector` matching "everything in the current view" (FR-025).
`delete` requires `confirm: true` (FR-026). Returns `{ affected: number }`. → FR-025, FR-026.

## Tags

### `GET /api/tags?prefix=`
List existing tags, optionally filtered by prefix for type-ahead suggestions (FR-012).

## Saved searches

### `GET /api/saved-searches` · `POST /api/saved-searches` · `DELETE /api/saved-searches/:id`
CRUD for saved searches. Create body: `{ name, query_text, included_tags[], excluded_tags[] }`
(FR-028). `GET /api/saved-searches/:id/run` returns the matching bookmarks.

## Preferences

### `GET /api/preferences` · `PUT /api/preferences`
Read/update `{ default_sort, page_size, text_size }`; persisted across reloads (FR-029).

## Import / export

### `GET /api/export`
Return a Netscape bookmark HTML file (`Content-Disposition: attachment`) preserving each
bookmark's title, tags, and original `date_added` (FR-033). See contracts/bookmark-html.md.

### `POST /api/import`
Multipart upload of a Netscape bookmark HTML file. Adds bookmarks preserving title, tags, and
original date added; maps folders to tags; skips already-saved addresses (FR-034). Returns
`{ added: number, skipped: number }`.

## Notes
- All list/search endpoints exclude archived bookmarks except the explicit archive view.
- Timestamps are ISO-8601 UTC. IDs are integers.
