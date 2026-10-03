# Design decisions

Internal record for later-cycle impact analysis. Kept lightweight.

## Architecture

- **Node.js + Express (v4.21.2) JSON API + static web client.** Single personal
  user, so no authentication (never required by any scenario).
- **Server-rendered? No — thin API + vanilla-JS single page.** The client loads
  the whole (small, personal-scale) collection once and does live search/topic/
  status filtering in the browser for instant response (SCN-002 "live as you
  type"). Mutations go through the API and the client refreshes.
- **Shared pure logic** (`public/shared/filters.js`) is imported by BOTH the
  browser and the Node unit tests, so filtering/dedup rules are specified once
  and tested directly.

## Storage

- **JSON file store** (`data/bookmarks.json`), written through on every mutation.
  - *Why:* single-user, personal scale; must persist between sessions
    (non-functional backlog). A file is simple and reliable here.
  - *Alternative dropped:* SQLite / a database server — unnecessary weight for
    one user and a small collection. Revisit if multi-device sync is ever wanted
    (would be a new cycle).

## Automatic details (SCN-001) & failure (SCN-006)

- **Server-side fetch** of the linked page (`src/metadata.js`), because a browser
  cannot read arbitrary cross-origin pages. Parsing prefers Open Graph tags, then
  `<title>` / `<meta name=description>`; favicon from `<link rel=icon>` else
  `/favicon.ico`.
  - *Alternative dropped:* a third-party metadata API — avoids an external
    dependency/secret and keeps the personal data local.
- **Graceful failure:** `fetchMetadata` never throws; on any failure it returns
  `{ ok: false }`, and the client offers manual entry while still allowing the
  save (SCN-006). A blank title falls back to the site host.

## Topics (SCN-003)

- **Several topics per link** (client chose labels over folders in Phase 1).
  Stored as a string array; de-duplicated case-insensitively. Topic filter and
  text search combine (both narrow).

## Reading status (SCN-004)

- Boolean `unread`; new links default `unread: true`. Marking is **manual**
  (client explicitly rejected auto-on-open). Read links remain in the collection.

## Archive (SCN-005)

- Boolean `archived`. Archived links are a **separate scope**: excluded from the
  main collection view AND its search; reachable via a searchable archive view;
  restorable. Implemented in `filterItems` via the `scope` argument.

## Duplicates (SCN-009)

- No duplicate addresses. Comparison via `normalizeUrl` (case-insensitive, trailing
  slash ignored). `create` returns `{ duplicate, item }` (HTTP 409) and the client
  opens the existing link for editing. `update` refuses an address used by another
  link (`{ conflict }`, HTTP 409).

## Testing

- `node:test` unit tests for the pure filters, the metadata parser/fetcher (with
  an injected `fetchImpl`), and the store (temp files).
- Playwright (pinned 1.61.0) acceptance tests drive the real UI; metadata is
  stubbed via `page.route` and each test is isolated by a guarded
  `/api/_test/reset` endpoint (only active when `BOOKMARKS_TEST=1`).
