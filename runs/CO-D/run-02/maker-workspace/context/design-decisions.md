# Design decisions (cycle 1 implementation)

Production code lives in `implementation/`, built from the approved scenarios'
behaviour — not from the Phase 1 prototype (per project prohibition).

- **DD-1 — Durable JSON store** (`src/store.js`). A single JSON file with atomic
  writes, plus a `snapshots/` folder for page copies. Chosen over a native
  database to avoid a native build step in the trial image; adequate for one
  user's bookmarks. Swappable behind the store module later.
- **DD-2 — Search/sort/paging on the client** (`public/query.js`, `public/app.js`).
  The whole (lightweight) bookmark list is sent to the browser; live filtering,
  the query language, sorting, and the show-more limit run client-side for
  instant feedback. `query.js` is shared with Node for unit tests. Server-side
  search/virtualisation is the scaling path noted in the non-functional backlog
  (NFR-003). Bulk **Select all** and search always act on the full match set, not
  the page (SCN-016, SCN-020).
- **DD-3 — Metadata & snapshots via server fetch, degrading gracefully**
  (`src/pagefetch.js`). On save the server fetches the page for title,
  description, og:image and favicon (SCN-001), and stores an in-app copy — the
  PDF for PDFs, else an HTML snapshot with an injected `<base>` and a banner
  (SCN-018). Every network call has a timeout and falls back safely: a failed
  metadata fetch yields a URL-derived title; a failed snapshot is marked
  `failed` so the client can retry. Honesty: full asset-inlining of snapshots is
  a future enhancement; the copy currently keeps the HTML + base URL.
- **DD-4 — Netscape import via a token scanner** (`src/importexport.js`). Browser
  bookmark HTML relies on HTML5 auto-closing of `<DT>`, which `node-html-parser`
  does not implement, so import uses a regex token scanner that tracks folder
  depth directly and turns folder names into tags (SCN-019). `node-html-parser`
  is still used for page-metadata parsing of real pages.
- **DD-5 — Internet Archive is manual** (`/api/bookmarks/:id/copy` with
  `which:'ia'`). It calls the Save Page Now endpoint; unreachable networks return
  `ok:false` and the client simply shows no archive link. The in-app copy is
  automatic; the Internet Archive is a deliberate outside step (SCN-018).
- **DD-6 — Duplicate/address equivalence** (`src/urlutil.js`): host without
  `www.`, no trailing slash, scheme assumed https. Used by saving (SCN-002) and
  import de-duplication (SCN-019).
- **DD-7 — Preferences persisted server-side** (`/api/preferences`), applied on
  load (default sort, page size, text size via a wrap-level zoom) (SCN-020).

## Test strategy
- Unit: `tests/unit/query.test.js` (search language), `tests/unit/importexport.test.js`.
- Acceptance (Playwright, real UI + API): `tests/acceptance/app.spec.js`, with a
  local fixtures HTTP server providing pages the app fetches. Pinned to
  Playwright 1.61.0 to match the shared browser binaries.
