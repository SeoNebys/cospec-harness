# Phase 0 Research: Bookmark Manager

All Technical Context items are resolved; no NEEDS CLARIFICATION remain. Decisions
are constrained by the project runtime environment (Node.js 24, npm, Python,
Playwright 1.61.0 + Chromium, serve on `0.0.0.0`, app on port 4000).

## 1. Application shape and runtime

- **Decision**: Single Node.js (Express) process serving a JSON API under
  `/api/*` and a static single-page frontend from `public/`. Start via
  `npm start` → `node server/index.js`, listening on `0.0.0.0:4000`.
- **Rationale**: Single-user scope needs no separate services; one process is the
  simplest thing that satisfies the spec and matches the harness `app.json`
  contract. No frontend build step keeps the lockfile small and startup reliable.
- **Alternatives considered**: Next.js/React SPA with a bundler (more tooling,
  build complexity, larger lockfile — unjustified for one screen family);
  Python/FastAPI backend (viable, but Node keeps one language across front/back
  and pairs naturally with Playwright for capture).

## 2. Persistence

- **Decision**: Embedded SQLite via `better-sqlite3`; DB file at
  `data/bookmarks.db`. Snapshots/PDFs stored as files under `data/snapshots/`,
  referenced from the DB by bookmark id.
- **Rationale**: Single-user, file-based, zero external service; synchronous API
  is simple and fast for this scale; easy 100% retention across restart (SC-003).
  Large binary snapshots belong on the filesystem, not in the DB.
- **Alternatives considered**: JSON flat file (poor for search/bulk/concurrent
  writes), PostgreSQL (needs a server; overkill for one user), storing snapshots
  as BLOBs (bloats DB, complicates streaming to the browser).

## 3. Metadata capture (title, description, favicon, preview image)

- **Decision**: Metadata is fetched in a **preview step before the initial save**,
  not after creating the record. When the user enters an address, the client calls
  a preview endpoint that fetches the URL server-side (following redirects, with a
  timeout) and parses HTML for: `<title>` / `og:title`, meta description /
  `og:description`, favicon (`<link rel="icon">` variants, fallback
  `/favicon.ico`), and preview image (`og:image` / `twitter:image`). Parse with
  `node-html-parser`. The returned title/description are shown in an editable
  review form; the user adjusts them and then confirms, and the create request
  carries the (possibly edited) values. Persist absolute URLs; optionally cache
  the favicon/preview bytes for offline display.
- **Timeout / slow-or-failed retrieval**: the preview fetch uses a short timeout;
  on timeout or failure it returns fallback details (readable title derived from
  the normalized URL, empty description) so the review form is always populated and
  the user can continue and confirm (FR-003/005, US1 scenario 4).
- **Rationale**: Open Graph + standard head tags cover the vast majority of pages;
  server-side fetch avoids browser CORS limits and works headlessly.
- **Alternatives considered**: Rendering every page in Chromium just for metadata
  (slower/heavier than needed — reserve Chromium for the offline snapshot);
  third-party metadata APIs (external dependency, privacy, rate limits).
- **Failure handling**: On fetch/parse failure, derive a readable fallback title
  from the normalized URL and save with fields blank (FR-005).

## 4. Automatic offline copy + PDF handling

- **Decision**: **After the user confirms the initial save**, the created record
  is persisted immediately (with `offline_status = pending`) and the offline-copy
  attempt runs asynchronously so it never delays the saved bookmark. The attempt:
  - Detect content type. If the target is a **PDF** (content-type
    `application/pdf` or `.pdf`), download and store the bytes as
    `data/snapshots/<id>.pdf`.
  - Otherwise, open the page in the pre-installed **Playwright Chromium** and
    capture a **single-file MHTML** snapshot via the CDP
    `Page.captureSnapshot` command, stored as `data/snapshots/<id>.mhtml`.
  - Record capture status on the bookmark: `available` (with file + kind) or
    `unavailable`. Failure still saves the bookmark (FR-029, US1 scenario 6).
- **Rationale**: MHTML is a widely supported single-file archive that inlines
  page resources, giving a genuine best-effort offline copy without a bespoke
  resource crawler. Chromium is already installed and pinned via Playwright
  1.61.0, matching the shared browser binaries.
- **Alternatives considered**: `wget --page-requisites` mirroring (many files,
  brittle rewriting), saving only raw HTML with a `<base>` tag (images/CSS break
  offline), full WARC capture (heavier; not needed for single-user viewing),
  `SingleFile` library (extra dependency; MHTML via CDP is built in).
- **Serving**: MHTML/PDF served back for viewing via a dedicated endpoint;
  browser renders PDF natively and MHTML via a download/open affordance.
- **Performance/robustness**: Capture runs with a timeout and a reused browser
  context; it must not block persisting the bookmark record (kick off, then
  update status when done). Only best-effort per spec.

## 5. Internet Archive preservation (optional, manual)

- **Decision**: Provide a manual per-bookmark action that POSTs the URL to the
  Internet Archive "Save Page Now" endpoint (`https://web.archive.org/save/<url>`)
  and records the resulting snapshot link. Status: `none` / `pending` / `saved` /
  `failed`, retryable.
- **Rationale**: Matches FR-030 (optional, manual, separate from the automatic
  offline copy, failure never blocks saving).
- **Alternatives considered**: Auto-submitting every save to the Archive (spec
  says optional/manual; also rate-limited and slow); using the S3-style IA API
  with credentials (needs account/keys — out of scope for single-user local app).
- **Environment note**: Requires outbound internet; if unreachable in the review
  environment the action reports `failed`/`pending` and is retryable — reported
  honestly, never blocking.

## 6. Search query language (parser + semantics)

- **Decision**: Hand-written tokenizer + recursive-descent parser producing a
  boolean AST, then evaluated against bookmark fields. Grammar (see
  `contracts/search-query-grammar.md`):
  - **Terms**: bare word (matches title/description/notes/address,
    case-insensitive substring); quoted `"exact phrase"` (literal, spaces and
    operator words preserved); `#tag` (matches a tag).
  - **Operators**: `AND`, `OR`, `NOT` (case-insensitive as operators),
    parentheses for grouping. Implicit `AND` between adjacent terms.
  - **Literal operator words**: an `AND`/`OR`/`NOT` inside quotes is a literal
    term, not an operator (FR-015).
  - Precedence: `NOT` > `AND` > `OR`; parentheses override.
- **Rationale**: Small, dependency-free, fully testable; deterministic semantics
  the client asked for. Quoting rule cleanly disambiguates operator vs. literal.
- **Alternatives considered**: SQLite FTS5 MATCH syntax (its query dialect
  differs from the requested AND/OR/NOT + quoting semantics and leaks tag/field
  handling); a parser-generator dependency (unnecessary for this small grammar).
- **Execution**: AST compiled to a parameterized SQL `WHERE` where feasible
  (LIKE for text, tag joins for `#tag`), with archived items excluded from normal
  search by default (FR-026). Tag inclusion/exclusion from saved filters is
  AND-combined with the query.

## 7. Rich notes (simple formatting) + safety

- **Decision**: Notes edited in a `contenteditable` area with a small toolbar
  (bold, italic, bullet/numbered list, link). Stored as HTML, **sanitized
  server-side** with DOMPurify (allowlist: `b/strong, i/em, ul/ol/li, a[href],
  p, br`). Rendered as sanitized HTML on view (FR-027).
- **Rationale**: Gives real rendered formatting without a heavy editor framework;
  server-side sanitization prevents notes from breaking or altering the UI
  (edge case: notes formatting safety).
- **Alternatives considered**: Markdown source stored + rendered (also fine, but
  the spec says "apply formatting" and "not shown as raw markup" — a WYSIWYG
  contenteditable is a closer fit); full editor (TipTap/Quill) — heavier than
  "simple formatting" warrants.

## 8. Import / export (browser bookmark HTML)

- **Decision**: Support the Netscape Bookmark File Format (the `.html` browsers
  import/export). On **import**, parse `<DT><A HREF ADD_DATE TAGS>` entries,
  preserving title, `TAGS` (comma-separated), and `ADD_DATE` (epoch seconds →
  saved date); de-duplicate by normalized URL (FR-031). On **export**, emit the
  same format with `ADD_DATE` and `TAGS` populated (FR-032).
- **Rationale**: This is the "common browser bookmark HTML format" every major
  browser reads/writes; `TAGS`/`ADD_DATE` attributes are the standard carriers for
  tags and dates, satisfying the round-trip retention criterion (SC-005).
- **Alternatives considered**: JSON export (not browser-compatible), per-browser
  proprietary formats (unnecessary; the Netscape format is the interchange
  standard).
- **Robustness**: Malformed entries are skipped with a summary; valid ones import
  (edge case).

## 9. Address normalization + duplicate detection

- **Decision**: Normalize before storing/comparing: add scheme if missing
  (default `https://`), lowercase host, remove default ports, drop trailing slash
  on root, keep path/query/fragment as-is otherwise. Duplicates matched on the
  normalized form; re-saving opens the existing bookmark for editing (FR-006).
- **Rationale**: Catches trivial variants without over-collapsing distinct pages;
  content-based dedupe is explicitly out of scope (Assumptions).

## 10. Read/unread, archive, sorting, bulk, preferences

- **Decision**:
  - New bookmarks default to **unread**; unread view filters `read = 0`
    (FR-021/022).
  - **Archive** is a boolean flag; archived items excluded from normal list and
    search, shown only in the archive view; restore clears the flag; distinct
    from delete (FR-025/026).
  - **Sorting** by `saved_date` and `title`, asc/desc, via SQL `ORDER BY`
    (FR-010).
  - **Bulk**: client sends either an explicit id list or the current query/filter
    for "select all matching"; server applies add/remove tags, read/unread,
    archive, delete to the resolved set (FR-023/024). Bulk delete confirmed/undo.
  - **Preferences** (default sort, density, text size) persisted in a single-row
    `preferences` table; applied on load and across sessions (FR-033).
- **Rationale**: Straightforward relational modeling; "select all matching" by
  re-running the query server-side avoids sending huge id lists and stays correct
  for off-screen items.

## 11. Testing strategy

- **Decision**: `node:test` unit tests for the search parser/evaluator and the
  Netscape import/export round-trip (highest-risk logic). `@playwright/test`
  (pinned `1.61.0`, matching installed Chromium) e2e for primary flows: save →
  auto-metadata + offline-copy indicator, search (phrase/#tag/boolean/quoted
  operator), read-later, bulk, archive/restore, saved filter, import/export,
  preferences.
- **Rationale**: Concentrate unit tests on deterministic core logic; use e2e to
  prove the user-visible journeys from the spec. Pinning avoids downloading a
  second browser revision during a trial.

## Open questions

None. All Technical Context entries are decided above.
