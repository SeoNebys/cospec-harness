# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the approved spec, its
assumptions, and the runtime environment described in `CLAUDE.md` (Node 24, npm,
Python, Playwright 1.61.0 + shared Chromium). No open NEEDS CLARIFICATION items
remain. Key decisions below.

## 1. Application shape and server

- **Decision**: Single Node.js service using Express — REST API under `/api/*`,
  static hosting of the `public/` UI, and routes that serve captured assets.
  Listens on `0.0.0.0:4000`, started with `npm start`.
- **Rationale**: The runtime requires one foreground server on port 4000 bound to
  `0.0.0.0`. One process keeps startup and the `app.json` command trivial. Express
  is a stable, widely used minimal HTTP framework.
- **Alternatives considered**: Next.js/other full frameworks (adds a build step
  and heavier deps for a single-user app — rejected for simplicity); bare `http`
  module (more boilerplate for routing/static — rejected).

## 2. Storage

- **Decision**: Embedded SQLite via `better-sqlite3` for bookmark/tag records;
  local filesystem for snapshots, thumbnails, and favicons under `data/`.
- **Rationale**: Single-user, must survive restarts, no external service. SQLite
  gives durable relational storage (tags many-to-many, sort/filter/search) with
  zero server. Large binary assets (snapshots/PDFs/images) belong on disk, with
  the DB holding paths.
- **Alternatives considered**: JSON flat file (poor for search/sort at scale,
  concurrent write risk — rejected); external Postgres (violates "local, no
  external service" — rejected); storing blobs in SQLite (bloats DB, harder to
  serve — rejected).

## 3. Page detail extraction (title, description, favicon, preview image)

- **Decision**: Load the page in headless Chromium (Playwright), read the rendered
  HTML, and parse `<title>`, `<meta name/property=description>`,
  OpenGraph/Twitter tags (`og:title`, `og:description`, `og:image`), and favicon
  `<link rel="icon">` (falling back to `/favicon.ico`). The preview image is the
  `og:image` when present; otherwise a captured screenshot serves as the thumbnail.
- **Rationale**: Rendering with Chromium handles client-rendered pages better than
  a raw fetch and reuses the same browser session already needed for snapshot and
  thumbnail capture. OpenGraph is the de-facto standard for rich previews.
- **Alternatives considered**: Plain HTTP fetch + parse (misses JS-rendered
  metadata — rejected as primary, acceptable as a lightweight fallback); external
  link-preview API (external dependency — rejected).

## 4. Snapshot capture (faithful static; PDFs kept as PDFs)

- **Decision**: For web pages, capture a single-file MHTML archive via Chromium
  DevTools `Page.captureSnapshot`, stored as `.mhtml` and reopened in the browser.
  Also capture a full-page screenshot as the list thumbnail when no `og:image`
  exists. For addresses whose content type is PDF, download and store the original
  PDF bytes and reopen them as a PDF.
- **Rationale**: The client accepted a *faithful static* snapshot with no working
  interactivity. MHTML inlines the DOM, CSS, and images into one file that
  Chromium/most browsers render faithfully as a static page. PDFs are already a
  fixed-layout archival format, so passthrough is the correct preservation.
- **Alternatives considered**: Saving raw HTML only (loses images/CSS — rejected);
  full DOM + separate asset directory (more moving parts than MHTML — rejected);
  rendering everything to PDF (loses fidelity/selectable text for web pages, and
  is unnecessary given MHTML — rejected).

## 5. Content-type / PDF detection

- **Decision**: Determine target type from the HTTP `Content-Type` (and URL
  extension as a hint) before capture: `application/pdf` → PDF passthrough branch;
  otherwise → HTML render + MHTML branch. Record the snapshot type on the bookmark.
- **Rationale**: Drives which capture path runs and how the snapshot is later
  served/reopened (FR-007). Content-Type is authoritative over extension.

## 6. Duplicate detection and URL normalization

- **Decision**: Normalize addresses for comparison (lowercase scheme/host, strip
  default ports, remove trailing slash, drop fragments) and store a normalized key.
  On save, look up by normalized key across **both** active and archived
  bookmarks; on match, return/open the existing bookmark for editing instead of
  creating a copy (FR-018).
- **Rationale**: Prevents trivial near-duplicates (`http` vs trailing slash) while
  keeping behavior predictable. Import reuses the same lookup to avoid duplicates
  (FR-020).
- **Alternatives considered**: Exact string match only (misses obvious dups —
  rejected); aggressive normalization of query params (risks merging genuinely
  different pages — rejected; query strings are preserved).

## 7. Import/export format

- **Decision**: Netscape Bookmark File Format — the `<DL><DT><A HREF>` HTML that
  Chrome, Firefox, and Safari all import/export. On import, nested `<H3>` folders
  become tags on the contained bookmarks; existing addresses are not duplicated.
  Export emits the same format so exported files re-import cleanly (SC-008).
- **Rationale**: This is the "standard browser HTML bookmark format" the client
  approved; folders→tags matches the tags-only decision (no folders in v1).
- **Alternatives considered**: JSON/CSV export (not a browser-standard interchange
  — rejected as the primary format for v1).

## 8. Search, filter, sort

- **Decision**: Server-side query over SQLite: keyword search across title,
  address, description, notes, and tag names; filter by a selected tag; sort by
  date added or title, ascending or descending. Views (all/unread/archive) are
  query scopes over the same store.
- **Rationale**: Keeps a single source of truth and scales past in-memory limits;
  meets SC-003.
- **Alternatives considered**: Client-side filtering of the full set (fine at small
  scale but wasteful and duplicative — rejected as primary).

## 9. Testing approach

- **Decision**: `node:test` for unit (URL normalization, metadata parsing, Netscape
  import/export mapping) and contract (endpoint shapes) tests. Playwright 1.61.0
  (pinned in devDependencies to match `/opt/playwright-browsers`) for e2e UI flows,
  reusing the shared Chromium; no second browser download.
- **Rationale**: Matches available tooling in the image and the CLAUDE.md pinning
  requirement.

## 10. Readiness marker & runtime wiring

- **Decision**: The UI sets `data-harness-ready="true"` on the app shell once the
  initial view and its data have loaded (including a valid empty state). Provide
  `/work/.harness/app.json` with `kind: application`, port 4000, `start_command`
  `["npm","start"]`, `start_cwd` `/work`.
- **Rationale**: Required by the runtime presentation environment for review.
