# Contract: REST/JSON API

Base path `/api`. JSON request/response. Single-user, no auth. All list endpoints
honour the **current view** = search query + include/exclude tags + scope
(`all` | `unread` | `archive`) + sort + paging. Errors return
`{ "error": { "code", "message" } }` with an appropriate HTTP status.

## Bookmarks

### POST /api/bookmarks/preview
Fetch metadata for a URL **before** the first save so the user can adjust it (FR-003a).
- Request: `{ "url": string }`
- 200: `{ "url", "url_key", "title", "description", "faviconUrl", "previewImageUrl", "metadataUnavailable": bool, "existing": null | { "id" } }`
  - If `existing` is non-null the URL is already saved → client opens that
    bookmark for editing (FR-005).
- 400: invalid URL (FR-002).

### POST /api/bookmarks
Create a bookmark (metadata already fetched/adjusted).
- Request: `{ "url", "title", "description?", "noteMd?", "tags?": string[], "faviconUrl?", "previewImageUrl?", "metadataUnavailable?" }`
- 201: `Bookmark` (full record, incl. rendered note HTML).
- 200 + `{ "existing": { "id" } }`: URL already saved → edit existing, no duplicate (FR-005).
- 400: invalid URL.

### GET /api/bookmarks
List for the current view.
- Query params: `q` (search expression), `includeTags` (csv), `excludeTags` (csv),
  `scope` (`all`|`unread`|`archive`, default `all`), `sort`
  (`date_added_desc|date_added_asc|title_asc|title_desc`), `page`, `pageSize`.
- 200: `{ "items": Bookmark[], "total": number, "page", "pageSize" }`
  (archived excluded unless `scope=archive`; FR-029).
- 400: invalid search query (unbalanced quotes/parentheses) with a clear message (FR-017).

### GET /api/bookmarks/:id
- 200: `Bookmark`. 404 if missing.

### PATCH /api/bookmarks/:id
Edit fields (FR-006).
- Request: any of `{ "url", "title", "description", "noteMd", "tags": string[], "isRead", "isArchived" }`
- 200: updated `Bookmark`.
- 409: `url` collides with another bookmark's `url_key` (FR-007).
- 400: invalid URL.

### DELETE /api/bookmarks/:id
Permanent delete (client confirms first) (FR-028). Removes preserved files.
- 204.

### POST /api/bookmarks/bulk
Bulk action over an explicit id list **or** the entire current view (FR-023/024/025).
- Request:
  `{ "selection": { "ids": number[] } | { "matchAll": { "q?", "includeTags?", "excludeTags?", "scope?" } },
     "action": "addTags"|"removeTags"|"markRead"|"markUnread"|"archive"|"restore"|"delete",
     "tags?": string[] }`
- `matchAll` resolves the full server-side result set of that view — not a page (FR-023).
- `delete` requires the client to have confirmed (FR-025).
- 200: `{ "affected": number }`.

## Preservation (FR-032–035)

### POST /api/bookmarks/:id/preserve
Create the self-contained local HTML copy, or store the original PDF if the link
is a PDF. Fail-soft.
- 200: `{ "preservedHtmlPath"?, "preservedPdfPath"?, "status": "ok" }`
- 502: `{ "error", "status": "failed" }` (bookmark unaffected; FR-035).

### POST /api/bookmarks/:id/archive-org
Submit to Internet Archive Save Page Now; store snapshot link.
- 200: `{ "archiveOrgUrl": string }` | 502 fail-soft.

### GET /api/bookmarks/:id/preserved
Serve the preserved HTML (or PDF) for offline viewing. 404 if none.

## Tags (FR-020–022)

### GET /api/tags?prefix=
- 200: `{ "tags": [{ "name", "count" }] }` — all tags, or those matching `prefix`
  for suggestions (FR-021).

## Saved searches (FR-030–031)

### GET /api/saved-searches → `{ "items": SavedSearch[] }`
### POST /api/saved-searches
- Request: `{ "name", "queryText?", "includeTags?": string[], "excludeTags?": string[] }`
- 201: `SavedSearch`.
### DELETE /api/saved-searches/:id → 204 (bookmarks unaffected; FR-031)

## Import / export (FR-036–039)

### POST /api/import
- Request: multipart file (`bookmarks.html`, Netscape format).
- 200: `{ "imported": number, "skippedDuplicates": number, "failed": [{ "line?", "reason" }] }`
  (titles/tags/dates preserved; duplicates not re-added; unreadable entries reported).

### GET /api/export
- 200: `text/html` Netscape bookmark file (attachment) incl. titles and tags (FR-038).

## Preferences (FR-040)

### GET /api/preferences → `Preferences`
### PUT /api/preferences
- Request: `{ "defaultSort", "itemsPerPage", "textSize" }`; 200: updated `Preferences`.

## Object shapes

```jsonc
// Bookmark
{
  "id": 1, "url": "...", "urlKey": "...", "title": "...", "description": "...",
  "noteMd": "...", "noteHtml": "<sanitised>", "tags": ["news"],
  "faviconUrl": "...", "previewImageUrl": "...",
  "isRead": false, "isArchived": false, "metadataUnavailable": false,
  "preservedHtmlPath": null, "preservedPdfPath": null, "archiveOrgUrl": null,
  "dateAdded": "2026-09-24T...Z", "dateModified": "2026-09-24T...Z"
}
```
