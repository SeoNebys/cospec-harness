# API Contract: Bookmark Manager

HTTP + JSON API served by the Express backend on `0.0.0.0:4000`. All request and
response bodies are JSON unless noted. Errors use standard HTTP status codes with
`{ "error": { "code": string, "message": string } }`. This contract defines the
interface between the browser client and the server; field meanings are defined
in [data-model.md](../data-model.md).

## Conventions

- Timestamps are ISO-8601 strings.
- A `Bookmark` object returned by the API includes: `id`, `url`, `title`,
  `description`, `iconUrl`, `previewImageUrl`, `notesMarkdown`, `notesHtml`
  (rendered, sanitized), `tags` (array of names), `isRead`, `isArchived`,
  `dateAdded`, `dateModified`, `metadataStatus`, `preserved` (`{kind, status,
  href}`), `archiveOrg` (`{status, url}`).

## Bookmarks

### POST /api/bookmarks  — save (or route to existing)
Create a bookmark from an address; triggers async metadata + preservation.
- Body: `{ "url": string, "title"?: string, "description"?: string,
  "tags"?: string[], "notesMarkdown"?: string }`
- **201 Created** `{ bookmark }` when new.
- **200 OK** `{ bookmark, "duplicate": true }` when the normalized address already
  exists — returns the existing bookmark for editing; nothing is duplicated or
  overwritten (FR-007). Client navigates the user to it.
- **400** invalid/empty/malformed URL (FR-002).

### GET /api/bookmarks — list / browse
Query params: `view` (`all`|`unread`|`archive`, default `all`),
`sort` (`newest`|`oldest`|`title`|`recently_modified`), `tag` (filter by one tag,
FR-010), `page`, `pageSize` (defaults from preferences, FR-035).
- **200** `{ items: Bookmark[], total: number }`. Archived items excluded unless
  `view=archive` (FR-018).

### GET /api/bookmarks/:id — read one
- **200** `{ bookmark }` / **404**.

### PATCH /api/bookmarks/:id — edit
Editable: `url`, `title`, `description`, `tags`, `notesMarkdown` (FR-004).
- Editing `url` re-normalizes and re-checks duplicates; a collision with a
  *different* bookmark returns **409** `{ error, existingId }` (FR-004/FR-007).
- **200** `{ bookmark }`.

### POST /api/bookmarks/:id/read — set read status (FR-015)
- Body `{ "isRead": boolean }` → **200** `{ bookmark }`.

### POST /api/bookmarks/:id/archive — archive/restore (FR-017/FR-019)
- Body `{ "archived": boolean }` → **200** `{ bookmark }`.

### DELETE /api/bookmarks/:id — permanent delete (FR-020)
- Requires `?confirm=true` (client shows a confirmation step first).
- **204** / **400** when not confirmed.

### POST /api/bookmarks/bulk — bulk actions (FR-022/FR-023)
Apply one action to many bookmarks or to everything matching a query/filter.
- Body: `{ "selection": { "ids"?: number[], "matchQuery"?: string,
  "matchView"?: string, "matchTag"?: string },
  "action": "addTags"|"removeTags"|"markRead"|"markUnread"|"archive"|"delete",
  "tags"?: string[], "confirm"?: boolean }`
- `matchQuery`/`matchView`/`matchTag` express "select all matching current
  search/filter"; `delete` requires `confirm: true`.
- **200** `{ affected: number }`.

## Tags

### GET /api/tags — list all tags (FR-010 filter source).
- **200** `{ tags: [{ name, count }] }`.

### GET /api/tags/suggest?q=... — type-ahead suggestions (FR-009).
- **200** `{ suggestions: string[] }` (existing tags matching `q`).

## Search

### GET /api/search?q=... — run a query (FR-011–FR-014)
Also accepts `sort`, `page`, `pageSize`. The `q` grammar: case-insensitive;
`"exact phrase"`; `#tag`; `AND`/`OR`/`NOT`; parentheses; implicit AND between
adjacent terms (FR-013a); quoted `AND`/`OR`/`NOT` are literal text (FR-013b).
Archived items are excluded (FR-018).
- **200** `{ items: Bookmark[], total: number }`.
- **400** `{ error }` on malformed query (FR-014).

## Saved Views (FR-024)

- **GET /api/views** → `{ views: SavedView[] }`.
- **POST /api/views** body `{ name, searchText?, includedTags?, excludedTags? }`
  → **201** `{ view }`.
- **GET /api/views/:id/results** → resolves the saved combination and returns
  `{ items, total }`.
- **DELETE /api/views/:id** → **204**.

## Preservation (FR-026–FR-029)

### POST /api/bookmarks/:id/preserve/local — (re)generate local copy
Async; self-contained HTML for a page, original PDF for a PDF link.
- **202 Accepted** `{ preserved: { status: "pending" } }`.

### GET /api/bookmarks/:id/preserve/local/file — fetch the preserved copy
- **200** the `.html` (`text/html`) or `.pdf` (`application/pdf`) file / **404**
  if not ready.

### POST /api/bookmarks/:id/preserve/archive-org — submit to Internet Archive
Async, best-effort; never blocks (FR-029).
- **202 Accepted** `{ archiveOrg: { status: "pending" } }`.

## Import / Export (FR-030–FR-032)

### POST /api/import — import a Netscape bookmark HTML file
- `multipart/form-data` file upload. Preserves titles, tags, original dates;
  reconciles existing addresses (no duplicates), merges same-named tags.
- **200** `{ imported: number, reconciled: number, skipped: number }`.

### GET /api/export — export a Netscape bookmark HTML file
- **200** `text/html` attachment other browsers can import.

## Preferences (FR-035)

- **GET /api/preferences** → `{ defaultSort, itemsPerView, textSize }`.
- **PUT /api/preferences** body same shape → **200** updated preferences.

## Health / readiness

- **GET /healthz** → **200** `{ status: "ok" }` (used to confirm the server is up;
  the client sets `data-harness-ready="true"` once its initial UI + data load).
