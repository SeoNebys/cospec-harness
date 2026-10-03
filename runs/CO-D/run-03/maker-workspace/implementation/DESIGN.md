# Bookmarks app — internal design record (Cycle 1)

Implements approved scenarios SCN-001..SCN-017. Production code lives here in
`implementation/`, built from the approved GWT specifications (not from Phase 1
prototypes).

## Architecture / decisions

- **Runtime:** Node.js + Express (HTTP API + static frontend). Single-user app.
- **Storage:** SQLite via the built-in `node:sqlite` (`DatabaseSync`). Chosen over
  better-sqlite3 to avoid a native build step; durable, transactional, supports the
  whole-collection queries. DB + preserved copies live under `data/`
  (override with `BOOKMARKS_DATA_DIR` / `BOOKMARKS_DB`).
- **Frontend:** vanilla JS single-page app (`public/`), no build step. Talks to the
  JSON API. Marks `data-harness-ready` after preferences, collections and the first
  page load.
- **Whole-collection semantics (SCN-009):** listing loads all rows in the current
  status/archived scope, evaluates the search predicate in JS, sorts, then paginates
  by slicing. `matchingIds` recomputes the full id set for select-all-matching and
  bulk. For a single-user library this is simple and correct; if scale ever demands
  it, the same seam can push filtering into SQL/FTS without changing behaviour.
- **Search language (SCN-003):** hand-written recursive-descent parser in
  `lib/query.js` (NOT > AND > OR, implicit AND, parentheses; operator words are
  literals when quoted). Pure + unit-tested.
- **Dedup (SCN-006):** `lib/normalize.js` computes a `url_key` (ignore scheme, www,
  trailing slash, host case, fragment, known tracking params; keep other query
  params). Stored UNIQUE; create returns the existing row instead of duplicating.
- **Recently-updated (SCN-010):** `updated_at` is bumped only on meaningful edits
  (url/title/description/note/status/archived/tags); background copy/IA status
  changes do not reorder the list.
- **Preserved copies (SCN-013):** captured in the background after create (never
  blocks the save). Normal page → a genuinely self-contained single `.html`
  (`lib/snapshot.js` inlines stylesheets, their `@import`s and `url()` assets,
  images and fonts as data: URIs, and removes live `<script>`/`<base>`), so it
  renders as saved even if the origin later changes or disappears; PDF → the
  original bytes. Failure is recorded and retryable. Verified by
  `test/copy_selfcontained.test.js` (captures a page, takes its origin offline,
  asserts no live resource references remain).
- **Internet Archive (SCN-013/017):** strictly opt-in per bookmark; async submit to
  `web.archive.org/save/`; truthful pending/saved/failed states.
- **Import/export (SCN-015):** `lib/bookmarksHtml.js` parses/writes Netscape HTML.
  Standard TAGS + ADD_DATE; folders → tags on import (default on); "add to To read"
  default OFF; extras (NOTE/STATUS/ARCHIVED) as ignored-by-others attributes for a
  full round-trip here.
- **All network calls** are time-limited and never throw to the caller, so offline
  or blocked pages degrade to the approved fallback/error states.

## Scenario → code mapping

| SCN | Behaviour | Primary code |
|-----|-----------|--------------|
| 001 | Save + auto-fill + review + edit | `POST /api/preview`, `POST /api/bookmarks`, `PUT /api/bookmarks/:id`; `lib/metadata.fetchMetadata`; UI `openReview`/`openEdit` |
| 002 | Tags + formatted note | `repo.setBookmarkTags`, `/api/tags`; UI `tagWidget`, `renderNote` |
| 003 | Search language | `lib/query.js`; `repo.matchedSorted`; UI search box |
| 004 | To read / Finished / All; status at save/edit | `repo.scopeRows`, status field; UI status nav + choice |
| 005 | Archive vs Delete (confirmed); archive search scope | `/archive` `/restore` `DELETE`; archived excluded from non-archived scope; UI `confirmDelete` |
| 006 | Duplicate → existing to edit | `lib/normalize`, `repo.createBookmark` dedup; UI duplicate → `openEdit` |
| 007 | First-run empty; unreadable page | UI `showEmpty`; `fetchMetadata` fallback + review warn |
| 008 | Long content clamp; empty views | CSS line-clamp; UI `showEmpty` |
| 009 | Incremental load; whole-collection ops | `listBookmarks`/`matchingIds`; UI IntersectionObserver |
| 010 | Sort orders + remembered default | `repo.SORTERS`, preferences `default_sort`; UI sort select |
| 011 | Open original in new tab | UI `data-open` → `window.open(...,'_blank')` |
| 012 | Bulk + select-all-matching | `POST /api/bookmarks/bulk`, `resolveIds(match)`; UI bulk bar + match banner |
| 013 | Preserved copy + Internet Archive | `scheduleCapture`, `lib/metadata.captureCopy`/`submitInternetArchive`; UI `openDetail` |
| 014 | Live collections | `collections` table, `collectionQuery`; UI collections nav + builder |
| 015 | Import / export | `lib/bookmarksHtml`, `/api/import*`, `/api/export`; UI import/export modal |
| 016 | Display preferences | `settings` table, `/api/preferences`; UI `openPrefs`, `applyPrefs` |
| 017 | Edge cases (invalid import, big bulk, IA state, dead link) | import preview `ok:false`; progress/toasts; IA states; open still works, copy fallback |

## Tests

- `test/normalize.test.js`, `test/query.test.js`, `test/bookmarksHtml.test.js` — pure
  logic (dedup rules, query language, import/export round-trip).
- `test/repo.test.js` — repository integration on a temp DB (create/dedup, update +
  updated_at, list/scope/pagination, sort, archive/restore, bulk + select-all-matching,
  collections, import dedup, preferences).
- Run: `npm test` (node --test). 29 tests.
