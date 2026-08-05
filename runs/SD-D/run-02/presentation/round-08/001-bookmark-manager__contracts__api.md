# Phase 1 API Contract: Bookmark Manager

Local backend HTTP API consumed by the frontend. Shapes are described at contract level; exact
serialization is settled in implementation. All endpoints are local and single-user (no auth).

## Bookmarks

- **POST /bookmarks** — Save a bookmark from `{ url }` (title/description/tags optional).
  - Validates & normalizes the URL (FR-005). Invalid → `400` with a clear message, saves nothing.
  - If `normalized_url` already exists → `200` returning the **existing** bookmark (dedupe /
    redirect-to-edit behavior, FR-006), no new record.
  - Otherwise creates the bookmark, kicks off async metadata fetch + snapshot capture, and (if
    opted in) async archive submission. Returns `201` with the new bookmark; fetched fields
    populate shortly after and are retrievable via GET (FR-002, SC-001).
- **GET /bookmarks** — List bookmarks. Query params: `sort` (`newest`|`oldest`|`title`, default
  from Preferences), `read_state`, `archived` (default excludes archived), `q` (search), `tag`.
  Returns bookmarks with title, url, tags, icon/preview refs (FR-009/011/016).
- **GET /bookmarks/{id}** — Full bookmark incl. description, notes, snapshot status.
- **PATCH /bookmarks/{id}** — Edit title, url, description, notes, tags, read_state, archived
  (FR-003/019/020/022/024). Editing url re-normalizes.
- **DELETE /bookmarks/{id}** — Permanent delete (confirmation enforced in UI, FR-021).

## Search

- **GET /search?q=...** — Full-text search across title, url, description, notes, tags,
  case-insensitive (FR-013). Supports AND / OR / NOT / grouped / exact-phrase expressions and
  inline `tag:` terms (FR-014/015). Excludes archived unless scoped to the archive (FR-016).
  Empty result set is a normal `200` with zero items (UI shows the no-results state).

## Tags

- **GET /tags?prefix=...** — Existing tags, optionally matching a prefix, for reuse suggestions
  while typing (FR-018).

## Read-later / Archive (views + transitions)

- **GET /bookmarks?read_state=to_read** — Read-later view (FR-023).
- **GET /bookmarks?archived=true** — Archive view (FR-024/025).
- Read/archived transitions are performed via PATCH (single) or the bulk endpoint.

## Bulk actions

- **POST /bookmarks/bulk** — Apply one action to many. Body: `{ ids | matchQuery, action }`
  where `matchQuery` supports "select all matching" a search/filter (FR-028), and `action` is one
  of: add-tag, remove-tag, mark-read, mark-to-read, archive, delete (FR-029). Bulk delete requires
  the confirmation to have been given in the UI.

## Snapshots

- **GET /bookmarks/{id}/snapshot** — Serve the stored snapshot: the readable page for a web page,
  or the original PDF for a PDF link; `404`/unavailable indicator when none captured (FR-026/027).

## Saved searches

- **GET /saved-searches**, **POST /saved-searches** `{ name, query }`,
  **DELETE /saved-searches/{id}** — Manage named reusable searches (FR-033).

## Preferences

- **GET /preferences**, **PATCH /preferences** — Read/update default sort, text size, and the
  archive opt-in; persisted across sessions (FR-034, FR-027a).

## Import / export

- **POST /import** — Upload a Netscape bookmark HTML file; entries added with normalize+dedupe
  (FR-030); malformed file → `400`, nothing imported (FR-031).
- **GET /export** — Download the collection as a bookmark file (FR-032).
