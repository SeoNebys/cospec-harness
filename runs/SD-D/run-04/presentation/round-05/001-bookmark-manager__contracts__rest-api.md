# Contract: REST API

Local HTTP API exposed by the backend to the SPA. All requests/responses are JSON.
Base path: `/api`. Errors use `{ "error": { "code": string, "message": string } }`
with an appropriate HTTP status. Timestamps are ISO 8601 strings.

The `Bookmark` object returned by these endpoints has the fields defined in
`data-model.md` (id, url, title, description, notes, iconUrl, imageUrl, tags[],
readLater, archived, enrichStatus, createdAt, updatedAt).

## Bookmarks

### `GET /api/bookmarks`
List/search bookmarks using the filter model. Filter is supplied as query params
mapping to `contracts/filter-model.md`:
`text`, `tagsAny` (repeatable), `tagsAll` (repeatable), `tagsNot` (repeatable),
`view` (`all`|`readLater`|`archived`), `sort` (`newest`|`oldest`|`title`).
- **200** → `{ "bookmarks": Bookmark[], "total": number }`
- Empty result is a valid `200` with `bookmarks: []` (FR-024).

### `POST /api/bookmarks`
Create a bookmark. Body: `{ url (required), title?, description?, notes?, tags?[] }`.
- Validates and normalizes `url` (FR-002). Malformed → **400** with message.
- **Duplicate handling (FR-023)**: if the normalized `url_key` already exists, the
  server does **not** create a copy. It responds **200** with
  `{ "bookmark": Bookmark, "existing": true }` — the existing record, so the UI opens
  it for editing. A genuinely new bookmark responds **201** with
  `{ "bookmark": Bookmark, "existing": false }`, `enrichStatus: "pending"`.
- The save returns immediately; metadata enrichment runs in the background
  (research §3). The client reflects enrichment via `GET /api/bookmarks/:id` or the
  next list refresh.

### `GET /api/bookmarks/:id`
- **200** → `{ "bookmark": Bookmark }`  | **404** if not found.
Used to poll `enrichStatus`/pick up fetched description/icon/image.

### `PATCH /api/bookmarks/:id`
Partial update. Body may include any of: `url`, `title`, `description`, `notes`,
`tags[]`, `readLater`, `archived`.
- Editing `url` re-normalizes and re-checks the duplicate key. If it would collide
  with a **different** existing bookmark, respond **409** with
  `{ "error": { code: "duplicate_url", ... }, "existing": Bookmark }` so the UI can
  point the person at the existing one (FR-013, FR-023, edge case "editing an
  address to one that already exists").
- Toggling `readLater` (FR-015) and `archived` (FR-016, archive/restore) go through
  this endpoint. `updatedAt` is refreshed.
- **200** → `{ "bookmark": Bookmark }`.

### `DELETE /api/bookmarks/:id`
Permanently delete one bookmark (FR-017). Confirmation is a UI responsibility.
- **204** on success | **404** if not found.

### `POST /api/bookmarks/batch`
Apply one action to many bookmarks in a single call (FR-019/FR-020).
Body: `{ "ids": number[], "action": "addTag"|"archive"|"unarchive"|"delete", "tag"?: string }`.
- `addTag` requires `tag`.
- `delete` removes all listed ids (UI shows a single confirmation for the batch —
  edge case "batch delete").
- The client builds `ids` from the **currently showing** set for "select all showing"
  (FR-020); the server acts only on the ids given, so archived/hidden items are never
  affected.
- **200** → `{ "updated": number }` (or `{ "deleted": number }` for delete).

## Tags

### `GET /api/tags`
- **200** → `{ "tags": [ { "name": string, "count": number } ] }`.
Drives tag suggestions as the person types (FR-012) and the tag-filter UI. Names are
lowercased; suggestions are prefix/substring matches against this list.

## Saved Searches

### `GET /api/saved-searches`
- **200** → `{ "savedSearches": SavedSearch[] }` (id, name, queryText, filter, createdAt).

### `POST /api/saved-searches`
Body: `{ "name", "queryText"?, "filter": TagFilter }` (FR-021).
- **201** → `{ "savedSearch": SavedSearch }`.

### `PATCH /api/saved-searches/:id`
Rename or adjust. Body may include `name`, `queryText`, `filter`.
- **200** → `{ "savedSearch": SavedSearch }` | **404**.

### `DELETE /api/saved-searches/:id`
- **204** | **404**.

Applying a saved search is a client action: it loads the stored `queryText` + `filter`
and calls `GET /api/bookmarks` with them, so results are always live (FR-021).

## Backup (export / import)

### `GET /api/export`
Export the whole collection (FR-026/FR-027).
- **200** → an open-format JSON document (served as a file download) with shape:
  ```jsonc
  {
    "format": "bookmark-manager-export",
    "version": 1,
    "exportedAt": "<ISO timestamp>",
    "bookmarks": [ { url, title, description, notes, tags[], readLater, archived, createdAt, updatedAt } ],
    "savedSearches": [ { name, queryText, filter } ]
  }
  ```
- An empty collection exports a valid document with empty arrays (edge case
  "export of an empty collection").

### `POST /api/import`
Import a previously exported document (FR-028/FR-029/FR-030). Body: the export
document above.
- Validates `format`/`version` and structure first. Invalid/corrupt → **400** with a
  message and **zero changes** to the existing collection (FR-030).
- Applies the whole import in **one transaction**; on any error it rolls back so the
  collection is left exactly as it was (FR-030, edge case "failed/partial import").
- Merge semantics (FR-029): bookmarks whose normalized `url_key` already exists are
  **not** duplicated; their tags are merged into the existing entry. New bookmarks and
  saved searches are added.
- **200** → `{ "added": number, "alreadyPresent": number, "savedSearchesAdded": number }`
  (the summary shown to the person, FR-029).

## Non-endpoints (served, not API)

- `GET /` and static assets → the built SPA, so launching the local backend opens
  the whole app in the browser.
- "Open a bookmark's page" (FR-008) is a pure client action — it opens `bookmark.url`
  in a new browser tab; no API call.
