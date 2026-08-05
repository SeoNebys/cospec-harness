# Phase 0 Research: Bookmark Manager

All Technical Context items are resolved; no open NEEDS CLARIFICATION remain. The
decisions below record the reasoning behind the choices in `plan.md`.

## 1. Application shape — local web app vs. pure browser vs. desktop

- **Decision**: Local web application — a Node backend the person runs, opened in
  their browser at `localhost`; the backend also serves the built SPA.
- **Rationale**: Two requirements can't be met by a browser-only app. (1) FR-005
  needs to fetch preview metadata (description, icon, image) from arbitrary third-party
  pages; browsers block cross-origin reads, so fetching must happen server-side.
  (2) FR-022/SC-004 need durable local persistence with fast search; an embedded
  server-side DB is simpler and more reliable than browser storage for a few thousand
  records with FTS + boolean tags. Running the backend locally keeps the "single
  user, single device, no accounts" scope (Assumptions) intact.
- **Alternatives considered**:
  - *Pure browser SPA (IndexedDB)*: rejected — cross-origin metadata fetch blocked;
    boolean-tag + FTS search harder to do well in IndexedDB.
  - *Electron/Tauri desktop app*: viable and gives "one clickable app," but heavier
    to build and package for v1. The local-web-app approach reaches the same
    single-user outcome with a smaller footprint; a desktop wrapper can be added
    later without changing the core.

## 2. Local persistence — SQLite

- **Decision**: SQLite database file on local disk, accessed via better-sqlite3
  (synchronous, in-process).
- **Rationale**: Zero-config, single-file, durable — ideal for a single-user local
  app. Native FTS5 gives instant text search; relational joins express the tag
  boolean logic (any/all/not) cleanly. Easily handles the few-thousand-row scale
  (SC-002/SC-005) with room to spare.
- **Alternatives considered**: A JSON/flat file (rejected — no indexed search, risk
  of corruption on write, poor at boolean tag queries); a client-server DB like
  Postgres (rejected — needless operational weight for one local user).

## 3. Metadata fetching — best-effort, non-blocking (FR-005, SC-001, SC-006)

- **Decision**: On save, the bookmark is persisted **immediately** with whatever the
  person typed. The server then attempts a metadata fetch with a **short timeout
  (~5 s)** and, on success, updates the record; the frontend reflects the enriched
  card when ready. Fetch parses, in priority order, Open Graph tags (`og:title`,
  `og:description`, `og:image`), Twitter Card tags, then standard `<title>` /
  `<meta name="description">`, and resolves a favicon (`<link rel="icon">` or
  `/favicon.ico`).
- **Rationale**: Guarantees saving never blocks or fails on a slow/unreachable page
  (FR-005, edge case "unreachable page"), keeps save well under the 20 s budget
  (SC-001), while still enriching the ~90% of pages that publish standard preview
  data (SC-006). Partial data is stored as-is (edge case "partial preview data").
- **Alternatives considered**: Synchronous fetch inside the save request (rejected —
  a slow page would blow the save-time budget and risk a failed save); a headless
  browser render (rejected — heavy; most sites expose OG/meta in static HTML).
- **Safety note**: Because the server fetches arbitrary URLs, requests use a
  timeout, a capped response size, a limit on redirects, and only follow http/https —
  guarding against hangs and oversized responses. (Full SSRF hardening is noted for
  a future networked deployment; out of scope for a single-user local tool.)

## 4. Search & boolean tag filtering (FR-009/010/011)

- **Decision**: Text and quoted-phrase search run against a SQLite **FTS5** virtual
  table over title/address/description/notes/tags; matching is case-insensitive by
  default. Tag filtering (any-of / all-of / excluding) is expressed as SQL over the
  bookmark↔tag join and combined with the text match. See `contracts/filter-model.md`
  for the exact filter structure and evaluation semantics.
- **Rationale**: FTS5 gives instant phrase and term search; joins give exact,
  explainable boolean tag semantics that are easy to test. Both compose in one query,
  so the whole filter (text + any/all/not) evaluates server-side in a single pass.
- **Alternatives considered**: In-memory JS filtering (rejected — re-scans everything
  per keystroke, doesn't scale as cleanly, phrase handling is manual); `LIKE '%..%'`
  only (rejected — no phrase ranking, slower, awkward for large notes).

## 5. Rich-text notes (FR-003, FR-018)

- **Decision**: Notes are authored and stored as **Markdown** (a constrained subset:
  headings, bullet lists, links). On display, Markdown is rendered to HTML and passed
  through a **sanitizer with a strict allowlist** (headings, `ul`/`li`, `a` with safe
  `href`, basic emphasis). Anything outside the allowlist is stripped/shown as text.
- **Rationale**: Markdown is a natural, storable plain-text format that round-trips
  cleanly and keeps the door open to export. Sanitization satisfies FR-018's
  "unsupported markup shown as plain text without breaking the display" and blocks
  script injection from pasted content.
- **Alternatives considered**: Storing raw HTML (rejected — sanitization burden,
  harder to export/diff); a heavyweight WYSIWYG document model (rejected — overkill
  for headings/bullets/links).

## 6. Duplicate detection via URL normalization (FR-023, SC-007, Assumptions)

- **Decision**: Every address is normalized to a canonical form used as the
  duplicate key: lowercase scheme+host, add `https://` when the scheme is omitted,
  drop a trailing slash on the path, strip a default port and a `#fragment`. Two
  bookmarks are "the same" when their normalized keys match. On saving a match (or
  editing an address into an existing key), the app returns the existing bookmark
  for editing rather than creating a duplicate or dead-ending.
- **Rationale**: Directly implements the approved Assumption that `example.com` and
  `https://example.com/` are the same, and FR-023's "open the existing one" behaviour.
  A stored normalized key with a uniqueness constraint enforces SC-007 (zero
  duplicates) at the data layer, not just the UI.
- **Alternatives considered**: Exact-string matching (rejected — misses trivial
  variants the client explicitly called out); aggressive normalization that strips
  query strings (rejected — query params often identify distinct pages, e.g. `?id=`).

## 7. Testing strategy

- **Decision**: Vitest for unit (url normalize, notes sanitize, metadata parse,
  filter→SQL builder) and integration (routes against an in-memory SQLite DB, covering
  CRUD, batch, filter, and duplicate handling). Playwright for one e2e flow per user
  story (US1–US5), each asserting that story's acceptance scenarios.
- **Rationale**: Mirrors the spec's "each user story independently testable"
  structure and lets acceptance scenarios map 1:1 to automated checks.
- **Alternatives considered**: Manual testing only (rejected — SC-004/SC-007 are
  regression-prone and deserve automated guards).
