# Phase 0 Research: Bookmark Manager

All decisions target the shared runtime image (Node.js 24, npm, Python, C/C++ toolchain,
Playwright 1.61.0 + Chromium at `/opt/playwright-browsers`). No unresolved
`NEEDS CLARIFICATION` remain from the Technical Context.

## D1. Application shape — one Node web app

- **Decision**: A single Node.js (ES modules) process using **Express** that serves a JSON
  API under `/api` and the static SPA. Starts with `npm start`, listening on `0.0.0.0:4000`.
- **Rationale**: The runtime contract requires one foreground server on port 4000 reachable
  at `http://maker:4000`. One process for one user is the simplest thing that works and keeps
  client + server in a single codebase. Express is stable, well-understood, and minimal.
- **Alternatives considered**: Next.js/Nuxt (unneeded SSR + heavier build); serverless/split
  frontend+backend (no benefit for a single-user local app, more moving parts).

## D2. Persistence — file-based SQLite

- **Decision**: Store all data in a single SQLite file `data/bookmarks.db`. Saved copies
  (HTML snapshots, PDFs) are stored as files under `data/snapshots/` with paths recorded in
  the DB. **Driver update (implementation):** originally planned on `better-sqlite3`, but its
  prebuilt native binary aborts at process teardown under Node 24 (Statement finalizer runs
  after the V8 environment is gone). Switched to Node's built-in **`node:sqlite`
  (`DatabaseSync`)**, which is API-compatible for our usage (`prepare().run/get/all`, `@name`
  bindings), needs no native build, and shuts down cleanly. Architecture (embedded file-based
  SQLite) is unchanged.
- **Rationale**: SQLite gives durable local persistence with zero external services (matches
  the "local persistence, no external DB" assumption), transactions for import and bulk
  actions, and relational modelling for the many-to-many bookmark↔tag relationship.
  `better-sqlite3` is synchronous (simpler code, fine for one user) and ships a prebuilt
  binary compatible with Node 24; the C/C++ toolchain is present if a rebuild is needed.
  Storing large blobs (snapshots/PDFs) on the filesystem rather than in the DB keeps the DB
  small and lets the browser open saved copies directly.
- **Alternatives considered**: JSON flat file (no transactions, poor for search/bulk at
  scale, risk of corruption on concurrent writes); Postgres/MySQL (external service,
  overkill, violates the no-external-service assumption); storing blobs in-DB (bloats DB,
  complicates serving files to the browser).

## D3. Search — custom query parser + evaluator

- **Decision**: Implement a small query grammar and evaluator in `services/search.js` rather
  than delegating to SQLite FTS5 syntax. Grammar: bare terms (case-insensitive substring
  across title/description/notes/address), `#tag` terms (tag membership), `"exact phrases"`,
  and boolean `AND` / `OR` / `NOT` with parentheses; whitespace between terms is implicit
  AND. Quoted operator words (e.g. `"AND"`) are literals, not operators.
- **Rationale**: The spec has precise, testable semantics (FR-017–020) — notably that plain
  text combined with `#tag` must narrow conjunctively, and that a quoted `"AND"` is literal
  text. A purpose-built tokenizer → parser (recursive descent to an AST) → evaluator gives
  exact control over these rules and is fully unit-testable, independent of any storage
  engine's quirks. At the target scale (~1,000, up to low thousands) evaluating the AST over
  candidate rows in memory/SQL is comfortably within the "instant" budget (SC-005).
- **Alternatives considered**: SQLite FTS5 (its boolean/quote syntax does not match the
  spec's literal-`"AND"` and text+`#tag` conjunction rules and would need escaping gymnastics;
  harder to test to the letter); naive `LIKE` chains (cannot express grouping/precedence).

## D4. Automatic page information (FR-002, FR-006)

- **Decision**: On save, the server fetches the address over HTTP and parses the response with
  `cheerio` to extract: title (`<title>` / `og:title`), description (`meta description` /
  `og:description`), preview image (`og:image` / `twitter:image`), and site icon (`<link
  rel="icon">`, falling back to `/favicon.ico`). A short timeout and size cap apply. On any
  failure the save still succeeds with an address-derived title and empty editable fields.
- **Rationale**: Directly satisfies FR-002 and the graceful-degradation requirement FR-006.
  `cheerio` is a lightweight, dependency-light HTML parser; a plain fetch avoids launching a
  browser for the common case. Fetching happens server-side to avoid browser CORS limits.
- **Alternatives considered**: Always render with Chromium (slower, heavier for simple
  metadata); client-side fetch (blocked by CORS); third-party metadata API (external
  dependency, privacy, not needed).

## D5. Saved copies — self-contained HTML snapshot & PDF storage (FR-030, FR-031)

- **Decision**: For a web page, render it with the installed **Playwright Chromium** and
  produce a **single self-contained HTML file** by inlining stylesheets and images as
  `data:` URIs, saved under `data/snapshots/<id>.html`. When the address's content type is
  PDF, stream and store the **PDF file itself** under `data/snapshots/<id>.pdf` instead. The
  saved copy is served back to the browser for reopening.
- **Rationale**: A rendered snapshot captures the page as seen (FR-030 "self-contained local
  HTML file"); inlining resources makes the file openable offline without external requests.
  Chromium is already installed and pinned via Playwright 1.61.0, so no extra browser download
  (respects the "do not download a second browser version" constraint). Content-type
  detection cleanly routes PDFs to file storage per FR-031.
- **Alternatives considered**: `monolith`/`single-file-cli` external binaries (not guaranteed
  present in the image); saving only raw HTML without inlining (breaks offline rendering,
  fails "self-contained"); screenshot image (loses selectable text/links, not HTML).

## D6. Internet Archive preservation (FR-032)

- **Decision**: A dedicated `services/archive.js` submits the address to the Internet
  Archive "Save Page Now" endpoint and records the resulting archived URL on the bookmark.
  Any error or timeout is caught; the bookmark and its local copy are untouched and the UI
  reports the failure honestly.
- **Rationale**: Matches FR-032 exactly and the CLAUDE.md directive to report unavailable
  external services honestly. Isolating it in one service keeps the external dependency
  contained and easy to stub in tests.
- **Alternatives considered**: Treating archive failure as fatal (violates FR-032); no
  archive option (drops a required feature).

## D7. Markdown notes (FR-014)

- **Decision**: Store note source as Markdown text; render with `marked` and sanitize the
  resulting HTML with `sanitize-html`, allowing only bold, italics, lists, and links. The raw
  Markdown text is what search indexes (FR-017).
- **Rationale**: Lightweight Markdown is exactly the confirmed scope. Sanitizing the rendered
  HTML prevents stored-XSS from note content even for a single-user app (defense in depth).
- **Alternatives considered**: Full rich-text/WYSIWYG editor (out of scope, heavier);
  rendering Markdown unsanitized (XSS risk); storing HTML directly (harder to search as text).

## D8. Import / export — Netscape bookmark HTML (FR-033, FR-034)

- **Decision**: Export generates a standard Netscape "bookmark file" (`<DL><DT><A>` list) in
  which each `<A>` carries `HREF`, the title as its text, `ADD_DATE` (original date added),
  and `TAGS` attribute (comma-separated). Import parses that format with `cheerio`, mapping
  `TAGS` and enclosing folder (`<H3>`) names to tags, `ADD_DATE` to the original date added,
  and skips addresses already saved (no duplicates).
- **Rationale**: The Netscape format is the common browser-bookmark HTML interchange format;
  `ADD_DATE` and `TAGS` are widely recognized attributes, letting us preserve title, tags, and
  original date added per the revised FR-033/FR-034 and SC-008 without a proprietary format.
- **Alternatives considered**: CSV/JSON export (not the requested browser format); addresses
  only (fails the "preserve title/tags/date" correction); requiring a specific browser's
  dialect (less portable).

## D9. Client — vanilla JS SPA bundled with esbuild

- **Decision**: A framework-free single-page app in ES modules, bundled once by `esbuild` at
  build time into `public/`, talking to the JSON API via `fetch`. Views: all/list, unread,
  archive, saved searches, settings, and a bookmark editor. A single visible root element is
  marked `data-harness-ready="true"` after the initial view and data have loaded.
- **Rationale**: The UI is CRUD-plus-filtering; vanilla JS keeps dependencies and build
  complexity minimal while `esbuild` gives fast, single-tool bundling. Meets the harness
  readiness-marker contract. Build happens during preparation so `npm start` only runs the
  prepared server.
- **Alternatives considered**: React/Vue/Preact + Vite (more dependencies and build surface
  than this scope needs); no bundler / many `<script>` tags (worse caching and structure);
  server-side templating (poorer interactivity for bulk-select and live search).

## D10. Testing strategy

- **Decision**: Unit-test the pure logic (search parser/evaluator, import/export
  parsing/generation, metadata extraction from fixture HTML) with `node:test`. Integration-
  test API routes against a temporary SQLite file. End-to-end test each user story's primary
  flow with Playwright 1.61.0 driving the running server; external fetches (target pages,
  Internet Archive) are stubbed/served locally so tests are deterministic and offline.
- **Rationale**: Aligns tests to the spec's independently-testable stories and success
  criteria; pinning Playwright to 1.61.0 matches the installed browser revision per CLAUDE.md.
- **Alternatives considered**: Jest/Vitest (extra dependency vs. built-in `node:test`);
  hitting live external sites in tests (flaky, network-dependent, disallowed for reliability).

## Cross-cutting notes

- **Ordering & dates**: every bookmark records `date_added` and `date_modified` (FR-035);
  default sort is most-recently-added first (FR-027).
- **Duplicate handling**: address is normalized (scheme added if missing, FR-004) and treated
  as the identity key; saving an existing address opens it for editing (FR-005); import skips
  existing addresses (FR-034).
- **Graceful degradation** is a first-class behavior for metadata (FR-006) and Internet
  Archive (FR-032); both are covered by dedicated acceptance scenarios and e2e stubs.
