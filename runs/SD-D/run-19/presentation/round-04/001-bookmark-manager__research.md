# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the spec, the project runtime
notes (CLAUDE.md), and the installed image. No open NEEDS CLARIFICATION remain.

## R1. Application shape & runtime

- **Decision**: Single Node.js 24 web app; Express serves a build-free ES-module
  SPA and a `/api` JSON backend on `0.0.0.0:4000`. `data-harness-ready="true"`
  is set once the initial view and data have loaded.
- **Rationale**: Matches the mandated review environment (port 4000, `0.0.0.0`,
  `npm start`). One project = one lockfile, minimal moving parts for a
  single-user app. No frontend build step avoids toolchain fragility in the
  harness.
- **Alternatives considered**: React/Vite SPA (adds build + browser-download
  risk, unneeded for one user); server-rendered multi-page (weaker for
  live bulk-selection and instant search UX).

## R2. Storage

- **Decision**: better-sqlite3, one file `data/bookmarks.db`; preserved copies
  and PDFs as files under `data/preserved/`, referenced by path.
- **Rationale**: Embedded, zero external service, synchronous API (simple code),
  easily handles thousands of rows well under the 1s search budget. Binary
  blobs (preserved pages) belong on the filesystem, not the DB.
- **Alternatives considered**: JSON file (no transactions/indexing, poor at
  1,000+ and concurrent writes); Postgres/MySQL (external service, over-scoped
  for single-user); storing preserved HTML in the DB (bloats DB, harder to open).

## R3. Search semantics & implementation

- **Decision**: Custom tokenizer → recursive-descent parser → AST → parameterised
  SQL. Grammar: implicit AND between adjacent terms; explicit `AND`/`OR`/`NOT`
  (case-insensitive keywords) with `NOT` highest, then `AND`, then `OR`;
  parentheses group. `#tag` is a tag-membership term. Double-quoted text is a
  literal phrase; a quoted operator word (`"AND"`) is a literal term. Plain terms
  match as case-insensitive substrings across title, description, note, address.
  Ordinary text + `#tag` together ⇒ ANDed (both must hold).
- **Rationale**: The spec requires substring, case-insensitive matching plus full
  boolean logic and literal quoting — exactly a small parser's job. Compiling to
  `LIKE '%term%' COLLATE NOCASE` (with `%`/`_`/`\` escaped) over an indexed table
  is trivially within budget for the target scale and gives predictable,
  testable semantics.
- **Alternatives considered**: SQLite FTS5 — token/prefix based, does not
  naturally do arbitrary substring matching and complicates the exact
  quoted-operator rule; rejected. Naive string scanning in JS — loses SQL
  filtering/paging and is slower for large sets.
- **Validation**: parser has unit tests per spec acceptance case (US5),
  including `#news AND "open source"`, `"AND"` literal, `report #news`
  (both-match), and unbalanced quotes/parentheses → reported invalid (FR-017).

## R4. Automatic metadata capture

- **Decision**: Reuse installed Playwright/Chromium to load the page and read
  `<title>`, meta description (`meta[name=description]`/OpenGraph
  `og:description`), favicon (`link[rel~=icon]`, fallback `/favicon.ico`), and
  preview (`og:image`/`twitter:image`). Runs server-side on save; the collected
  title/description are returned to the client for adjustment before the initial
  save (FR-003a). Fetch is time-bounded; on failure the bookmark saves with a
  URL-derived title and a "metadata unavailable" flag (FR-004).
- **Rationale**: Chromium is already provisioned; it handles JS-rendered pages
  and OpenGraph reliably. Fail-soft satisfies FR-004 and SC-001.
- **Alternatives considered**: Plain `fetch` + HTML parse (misses JS-rendered
  metadata; kept as a lightweight fallback path only). Third-party metadata APIs
  (external dependency, privacy, not needed).

## R5. Page preservation (single-file HTML), PDF, Internet Archive

- **Decision**: For HTML pages, render in Chromium and serialise to a single
  self-contained `.html` with CSS, images, and fonts inlined as `data:` URIs,
  then sanitise; store under `data/preserved/<id>.html`. If the address is a PDF
  (by response content-type and/or `.pdf`), download and store the original PDF
  instead (FR-033) — no HTML wrapper. Internet Archive: POST the URL to the
  Wayback "Save Page Now" endpoint and store the returned snapshot link (FR-034).
  Every preservation path is fail-soft: on error the bookmark is unaffected and
  the user is told it did not complete (FR-035).
- **Rationale**: Inlining to one HTML file makes the copy portable and offline-
  openable (FR-032). Chromium already loads assets, so capturing them is direct.
  PDFs are already self-contained, so the original is the best preservation.
- **Alternatives considered**: External `monolith`/`single-file-cli` binaries
  (extra install, version risk) — reuse Chromium instead. MHTML (less portable
  across browsers than inlined HTML).

## R6. Markdown notes

- **Decision**: Store the Markdown source verbatim; render on display with
  markdown-it, then run the output through sanitize-html (allowlist) to prevent
  script injection.
- **Rationale**: Meets FR-008 (Markdown, verbatim source, correct render) while
  keeping stored content safe to display.
- **Alternatives considered**: Rich-text/WYSIWYG storage (client explicitly
  rejected); rendering unsanitised HTML (XSS risk even for single-user).

## R7. Import / export (Netscape bookmark HTML)

- **Decision**: Parse the standard Netscape `<DL><DT><A>` format with
  node-html-parser: read `HREF`, link text (title), `ADD_DATE` (dates), and
  `TAGS` attribute where present (tags). Import skips/updates addresses already
  saved (no duplicates, FR-037) and reports unreadable entries while importing
  valid ones (FR-039). Export emits the same format including titles and tags.
- **Rationale**: This is the universal browser interchange format the client
  confirmed; attribute-level parsing preserves titles/tags/dates (FR-036).
- **Alternatives considered**: JSON/CSV (not the requested interchange format);
  full DOM libraries like jsdom (heavier than needed for this flat structure).

## R8. Duplicate detection & URL handling

- **Decision**: Normalise URLs (lowercase scheme/host, strip default ports and
  trailing slash, keep query) to a canonical key used for duplicate detection.
  Saving an existing canonical URL opens the existing bookmark for editing
  (FR-005); an edit that collides warns and does not duplicate (FR-007).
- **Rationale**: Consistent key prevents near-duplicate churn and implements the
  "save → edit existing" behaviour.
- **Alternatives considered**: Exact string match (treats trivially different
  URLs as distinct); aggressive canonicalisation stripping queries (would merge
  genuinely different pages).

## R9. Archive vs delete & view scoping

- **Decision**: `archived` boolean on bookmark. Normal lists, search, unread view
  exclude archived rows; the archive view shows only archived rows (FR-029).
  Restore clears the flag; permanent delete removes the row and its preserved
  files (FR-026–028). "Select all matching" resolves the full server-side result
  set for the active view (search + tag include/exclude + unread/archive scope),
  not just the visible page (FR-023).
- **Rationale**: A single scope predicate drives both listing and bulk selection,
  guaranteeing they agree.
- **Alternatives considered**: Separate archived table (extra migration/joins for
  no benefit); soft-delete-only (loses the reversible-vs-permanent distinction
  the client requires).

## R10. Testing strategy & toolchain discipline

- **Decision**: `node --test` for unit (search parser, url, markdown, import/
  export) and integration (api + db) tests; Playwright Test pinned to 1.61.0 for
  e2e per user story, reusing shared Chromium at `/opt/playwright-browsers`.
  Keep `package-lock.json`; do not fetch a second browser revision.
- **Rationale**: Uses only in-image tooling; pinning avoids a browser-revision
  mismatch called out in CLAUDE.md.
- **Alternatives considered**: Vitest/Jest (extra dependency; built-in runner
  suffices).
