# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the spec and the runtime
environment; there are no outstanding NEEDS CLARIFICATION markers. This document
records the key decisions, rationale, and alternatives.

## 1. Application shape and runtime

- **Decision**: One Node.js (v24) web application using Express, serving a JSON
  API and static front end, listening on `0.0.0.0:4000`, started with
  `npm start`.
- **Rationale**: The runtime presentation environment expects a single
  foreground server on port 4000 reachable at `http://maker:4000`, started via
  an argument-array `start_command`. A single deployable is the simplest thing
  that satisfies this and the single-user scope.
- **Alternatives considered**: Separate frontend/backend deployables (rejected —
  two servers, more ceremony, no benefit for one user); a static-only SPA with
  browser-local storage (rejected — cannot fetch page metadata, cannot preserve
  self-contained HTML, cannot call the Internet Archive due to browser CORS).

## 2. Storage

- **Decision**: SQLite via `better-sqlite3`, single file under `data/`.
  Preserved copies stored as files under `data/preserved/`, referenced by path.
- **Rationale**: Embedded, zero-configuration, durable across restarts (SC-005),
  fast for up to thousands of rows, synchronous API simplifies the single-user
  server. Storing large preserved blobs as files (not DB rows) keeps the DB lean.
- **Alternatives considered**: JSON flat file (rejected — weak query/search,
  concurrency risk); PostgreSQL/other server DB (rejected — needless operational
  overhead for a single-user local app); storing preserved HTML/PDF as DB blobs
  (rejected — bloats the DB and complicates viewing/serving).

## 3. Metadata capture (title, description, icon, preview)

- **Decision**: Best-effort server-side fetch: request the page, parse `<title>`,
  meta description, Open Graph / Twitter card tags (`og:title`, `og:description`,
  `og:image`), and favicon links. Use Playwright/Chromium when a plain fetch is
  insufficient (JS-rendered pages) with a strict timeout; fall back to the
  address as display name on any failure (FR-005).
- **Rationale**: Chromium + Playwright 1.61.0 are already provided in the image;
  OG/meta tags are the standard source of preview metadata. A timeout keeps SC-001
  within the 15-second budget.
- **Alternatives considered**: Third-party metadata APIs (rejected — external
  dependency, single-user privacy); browser-side fetch (rejected — CORS blocks
  cross-origin metadata reads).

## 4. Address validation and normalization (FR-041)

- **Decision**: Accept only http/https. For duplicate matching, normalize by:
  lowercasing the host, dropping a default port (80/http, 443/https), and
  removing at most one trailing slash from the path. Scheme, remaining path,
  query, and fragment are compared exactly. Query params/fragments are **never**
  stripped wholesale; a small maintained allow-list of known-harmless items
  (initially empty/curated, e.g., common analytics params) may be ignored, and
  is applied identically on save, edit, and import.
- **Rationale**: Matches the spec exactly and the user's explicit instruction not
  to discard potentially meaningful query/fragment data.
- **Alternatives considered**: Aggressive canonicalization stripping all tracking
  params/fragments (rejected by the client — can merge distinct content);
  no normalization (rejected — trivial host-case/slash differences would create
  duplicates, violating FR-007/SC-006).

## 5. Search: phrase, `#tag`, boolean AND/OR/NOT with parentheses (FR-017/018/019)

- **Decision**: Hand-written recursive-descent parser producing an expression
  tree. Tokens: quoted phrases (operators inside quotes are literal text),
  `#tag` terms, bare words, and the operators AND/OR/NOT plus parentheses.
  Implicit AND between adjacent terms. The tree is evaluated against candidate
  bookmarks; term matching is case-insensitive across title, description, note
  (plain-text extract), address, and tag names. Malformed queries return a clear
  error (FR-019). Archived items are excluded unless the archive view is active
  (FR-020).
- **Rationale**: A custom parser gives precise control over the required
  semantics (quoted operators as words, `#tag`, precedence via parentheses) that
  a raw SQLite FTS query string cannot express directly. SQLite FTS5 may back the
  word-index for speed while the parser drives boolean composition.
- **Alternatives considered**: Passing user text straight to SQLite FTS5
  (rejected — cannot honor "AND as a literal word when quoted" or custom `#tag`
  semantics cleanly); a third-party query-DSL library (rejected — heavier than a
  small purpose-built grammar).

## 6. Formatted notes (FR-009/010) with safety

- **Decision**: Store notes as sanitized HTML limited to a safe subset (headings,
  bold/italic, lists, links). Sanitize on write and on render; strip scripts,
  event handlers, and unsafe URLs. Also keep a plain-text extraction of the note
  for search indexing.
- **Rationale**: Meets the "basic formatting" requirement and the Assumption that
  arbitrary scripts/unsafe content are not permitted; plain-text extract feeds
  case-insensitive search over notes.
- **Alternatives considered**: Markdown stored raw and rendered client-side
  (viable, but still requires sanitizing rendered output; HTML-subset chosen for
  a single canonical stored form).

## 7. Page preservation (FR-031/032/033/034)

- **Decision**: For a normal page, use Playwright/Chromium to render and produce
  a **single self-contained HTML file** with assets (images/CSS) inlined as data
  URIs, saved under `data/preserved/`. For a PDF address, download and store the
  PDF file itself. For Internet Archive, POST the address to its "Save Page Now"
  endpoint and store the returned archived-snapshot reference on the bookmark. All
  are best-effort; failures are reported and leave the bookmark unchanged.
- **Rationale**: Chromium can fully render and capture pages; inlining assets
  yields a genuinely self-contained artifact as the client requested. PDF links
  are stored verbatim per the spec.
- **Alternatives considered**: Saving a folder of page + separate asset files
  (rejected — not self-contained); screenshot-only capture (rejected — loses
  selectable text/content); a headless "single-file" third-party CLI (optional
  optimization, but Chromium capture avoids an extra dependency).

## 8. Import / export (FR-035/036/037)

- **Decision**: Support the Netscape Bookmark File Format (the standard
  `bookmarks.html` shared by major browsers). On import, parse anchors for
  address, title, `ADD_DATE`/`LAST_MODIFIED`, and `TAGS` (and map enclosing
  folders to tags when no TAGS attribute is present). Apply normalization for
  merge: existing bookmarks keep their own title/description/note/read/archive
  state/dates and only gain tags they lack (FR-036). Export writes the same
  format retaining titles, tags, and dates.
- **Rationale**: The Netscape format is the de-facto interchange standard, giving
  broad browser compatibility and retaining titles/tags/dates as required.
- **Alternatives considered**: A custom JSON export (kept as a possible extra,
  but not the required interchange format); per-browser proprietary formats
  (rejected — Netscape HTML is the shared standard).

## 9. Session / review environment (single shared collection)

- **Decision**: All data — bookmarks, tags, saved views, and display preferences
  — belongs to **one global, single-user collection** persisted in SQLite. It is
  **not** keyed by session or cookie. A cookie may be used behind the scenes
  (e.g., for CSRF or convenience), but it MUST NOT create or select a
  session-specific profile: every browser visit, and every restart of the app,
  sees the exact same collection and settings. The front end marks its shell
  `data-harness-ready="true"` only after the initial list (or a valid empty
  state) has loaded.
- **Rationale**: The spec is explicit that this is a sign-in-free single-user
  app; the client requires that a new browser visit or an app restart never
  yields an empty or divergent collection. Keying data to a session cookie would
  silently partition data into hidden per-session profiles — a defect to avoid.
- **Alternatives considered**: Per-session data scoping (rejected — would create
  hidden session-specific collections/settings, contradicting the single shared
  collection); no cookie at all (acceptable; a cookie is optional and, if used,
  must never partition data).

## 10. Testing strategy

- **Decision**: `node:test` for pure services (normalization, search parser,
  sanitizer, import/export merge) and API integration against a temporary SQLite
  DB; Playwright Test (pinned 1.61.0) for a few end-to-end flows (save→find→open,
  archive round-trip, bulk action). Pin `playwright`/`@playwright/test` to
  1.61.0 to match the shared browser binaries.
- **Rationale**: Fast, dependency-light, matches available tooling and the
  environment's pinned browser revision.
- **Alternatives considered**: Jest/Vitest (rejected — extra dependency;
  `node:test` suffices).
