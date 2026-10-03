# Design-decision record — Bookmarks app (Cycle 1)

Production implementation. Built fresh from approved scenarios' specifications
(SCN-001…SCN-018); Phase 1 prototype code was not reused.

## Architecture
- **Node.js + Express** HTTP server (`server.js`) serving a JSON API and a static
  vanilla-JS single-page frontend (`public/`). No SPA framework: the app is small,
  single-user, and benefits from zero build tooling.
- **SQLite via better-sqlite3** (`src/db.js`) for genuine persistent storage
  (`data/app.db`). Synchronous API keeps request handlers simple.
- **Shared isomorphic modules** (`src/*.js`) are used by the server, the browser
  (served at `/shared/`), and the tests — one implementation of the query language,
  note rendering, URL identity, and the bookmarks-file format.

## Key decisions (and dropped alternatives)
- **Client-side filtering/sort/paginate** over the full collection fetched once,
  vs. server-side querying. Chosen because it is a personal single-user collection;
  keeps search/tag/saved-filter logic in one place and instant. Large-collection
  performance is a later quality goal (NFR-003); per-page limit (SCN-018) bounds DOM.
- **URL identity** ignores a leading `www.`, trailing slash, and case, but keeps
  http vs https (`src/normalize.js#urlKey`). Basis for dedupe (SCN-003) and edit
  collision (SCN-011).
- **Search query language** is a hand-written recursive-descent parser
  (`src/query.js`): OR < AND(implicit/explicit) < NOT < atom; `#tag` exact,
  `"phrase"` literal, quoted operators become text, unbalanced parens are a hard
  error. Chosen over a library for zero deps and exact control of the approved rules.
- **Notes** use a minimal safe Markdown subset (`src/notes.js`); input is escaped
  first so pasted markup can never execute (XSS-safe).
- **Preservation** (`src/preserve.js`): pages are captured as a single self-contained
  HTML file (CSS and images inlined, scripts stripped); PDF links are stored as the
  PDF bytes. Stored in `preserved_content` and served from `/preserved/:id`.
- **Internet Archive** (`src/archive.js`) uses the public Save-Page-Now endpoint;
  it is a separate, explicit action gated by a public-copy confirmation in the UI.
  Failures are reported honestly (status `error`), never faked.
- **Metadata** (`src/metadata.js`) fetches the page and reads title/description/
  og:image/favicon via cheerio; failure returns `{failed:true}` so manual save still
  works (SCN-008).
- **Import/export** (`src/netscape.js`) uses the standard Netscape bookmark format;
  export nests archived items in an `Archived` folder; import is additive, skips
  existing URLs, and restores archived status from that folder (SCN-017).
- **Preferences & saved filters** persist server-side (`prefs`, `saved_filters`
  tables) so they survive across visits/devices for the account.

## Tests
- `test/unit.test.js` — pure logic (query, notes, netscape, normalize).
- `test/api.test.js` — HTTP API + SQLite against a temp DB.
- `e2e/acceptance.spec.js` — Playwright, Gherkin-based, drives the real UI.
Run: `npm test` (unit+api via node:test) and `npm run test:e2e` (Playwright).
