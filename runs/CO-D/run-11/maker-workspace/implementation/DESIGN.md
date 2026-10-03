# Design decisions & scenario–code map (cycle 1)

Production implementation of the approved scenarios SCN-001…SCN-018. Built fresh
from the Gherkin specifications (not derived from the Phase-1 prototypes).

## Architecture

- **Backend**: Node.js (built-in `http` only, no third-party runtime deps) —
  `server.js`. JSON-file persistence (`lib/store.js`) under `data/`
  (`store.json` + `snapshots/`). Chosen for zero-install robustness for a
  single-user app; filtering/sorting/search run client-side over the full list.
- **Frontend**: static SPA in `public/` (`index.html`, `style.css`, `app.js`),
  vanilla JS calling a small JSON API. Shared browser/Node logic in
  `lib/query.js` (search language) and `lib/urls.js` (URL rules), served to the
  browser at `/lib/*.js` and `require`d by tests.
- **Why client-side filtering**: single user, hundreds of items; keeps the API
  thin and the search/sort/paging instant. Performance at larger scale is a
  recorded non-functional concern.

## Key decisions

- **Metadata on save** is fetched server-side (`lib/metadata.js`) best-effort;
  on any failure the bookmark is still created with a host-derived fallback title
  (SCN-001, SCN-012).
- **Duplicate rule**: URLs normalised (scheme added, trailing slash dropped) in
  `lib/urls.js`; create returns 409 with the existing id; address edits that
  collide return 409 (SCN-003).
- **`updated` timestamp** bumped only on content/organisation edits (title, url,
  description, note, tags), never on read/archive changes — drives "Recently
  updated" sort (SCN-014).
- **Offline copy** (`lib/snapshot.js`): web pages saved as a single self-contained
  HTML file (external CSS inlined as `<style>`, images inlined as data URIs, a
  `<base>` + banner added); PDFs stored as the original file. Independent of the
  Internet Archive submission (`lib/wayback.js`). Failures return 502 and never
  block/alter the bookmark (SCN-016).
- **Import/export** (`lib/bookmarkfile.js`): Netscape format; import converts
  user folders (any depth) to tags, skips generic containers, retains titles,
  tags, saved dates, notes, and skips already-saved URLs (SCN-018).
- **Saved views / settings** persisted server-side (SCN-014, SCN-017).

## Scenario → code map

| Scenario | Primary code |
|---|---|
| SCN-001 capture + auto-fill | `server.createBookmark`, `lib/metadata.js`, `app.js save()` |
| SCN-002 edit title/url/desc/note | `server` PATCH `/api/bookmarks/:id`, `app.js` editor |
| SCN-003 no duplicates | `lib/urls.normalize`, `store.findByUrl`, POST/PATCH 409 |
| SCN-004 tags + suggestions | PATCH tags; `app.js` tag editor/`updateSuggest` |
| SCN-005 tag filter (incl/excl) | `app.js` `renderTagbar`/`currentFiltered` |
| SCN-006 search + highlight | `lib/query.js`, `app.js` `highlightText/highlightNotes` |
| SCN-007 query language | `lib/query.js` (+ `tests/query.test.js`) |
| SCN-008 markdown notes | `app.js` `mdToHtml` (escaped-first, safe subset) |
| SCN-009 read status + views | PATCH read; `app.js` statusbar/counts |
| SCN-010 archive | PATCH archived; `app.js` archive view/badges |
| SCN-011 delete | DELETE; `app.js` editor delete + confirm |
| SCN-012 invalid/unavailable | `lib/urls.isValid`, `createBookmark` fallback |
| SCN-013 wrapping/responsive | `style.css` (word-break, flex-wrap, media query) |
| SCN-014 sort/paging/text/default | `app.js` `currentFiltered`/controls; PUT `/api/settings` |
| SCN-015 bulk actions | POST `/api/bookmarks/bulk`; `app.js` bulk bar |
| SCN-016 offline copy + archive.org | `lib/snapshot.js`, `lib/wayback.js`, snapshot routes |
| SCN-017 saved views | `/api/views`; `app.js` views bar |
| SCN-018 import/export | `lib/bookmarkfile.js`; `/api/import`, `/api/export` |

## Tests

- Unit (`node --test`, `tests/*.test.js`): query language, bookmark-file
  import/export + folders-as-tags, metadata extraction, URL rules.
- Acceptance: Playwright pass over the running server covering SCN-001–018
  (see VERIFICATION.md for results). Live-network paths (metadata/snapshot/
  archive.org success) verified against a local fixture server; their failure
  handling verified offline.

## Deferred (later cycle)
- Automatic by-website grouping view.
- Non-functional backlog: large-collection performance; adjustable text size is
  implemented (moved into scope by the client).
