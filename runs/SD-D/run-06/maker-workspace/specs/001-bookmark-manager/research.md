# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the spec and the shared image;
no `NEEDS CLARIFICATION` markers remain. Decisions below record the choices made,
why, and what was rejected.

## 1. Runtime & server framework

- **Decision**: Node.js 24 + Express, one process serving both the JSON API and
  the static client, binding `0.0.0.0:4000`.
- **Rationale**: Node 24 and npm are pre-installed; Express is minimal and
  well-understood; a single process keeps the single-user app trivial to run via
  `npm start`, matching the runtime presentation environment (port 4000).
- **Alternatives considered**: Next.js/Nest (heavier, build pipeline, overkill
  for one user); pure Node `http` (more boilerplate for routing/static).

## 2. Storage

- **Decision**: SQLite via `better-sqlite3`, a single `data/bookmarks.db` file;
  preserved page copies stored as files under `data/preserved/`, referenced by
  path from the DB.
- **Rationale**: Local, single-writer, zero external service — fits the
  local-persistence assumption. Relational model cleanly expresses the
  bookmark↔tag many-to-many and saved views. `better-sqlite3` is synchronous and
  fast, simplifying request code and easily meeting <1s at 1,000+ rows.
  Large HTML/PDF blobs are kept on disk (not in the DB) to keep queries light.
- **Alternatives considered**: JSON flat file (poor for search/filtering at
  scale, concurrent-write risk); Postgres/MySQL (needs an external server,
  violates local single-instance simplicity); storing blobs in SQLite (bloats
  the DB and slows backups).

## 3. Metadata capture (title, description, icon, preview image)

- **Decision**: Use the pre-installed Playwright 1.61.0 + shared Chromium to load
  the page and read `<title>`, meta description / Open Graph (`og:description`),
  favicon / `apple-touch-icon` (icon), and `og:image` / `twitter:image`
  (preview). Fall back to `cheerio` parsing of a plain fetch when a full render
  is unnecessary. Runs asynchronously after the bookmark row is created.
- **Rationale**: Chromium handles JS-rendered pages and resolves relative icon
  URLs; Open Graph is the de-facto standard for description/preview. Async
  capture satisfies SC-001 (save returns immediately) and FR-005 (save still
  succeeds if capture fails).
- **Alternatives considered**: Fetch-only + cheerio for everything (misses
  JS-rendered metadata); third-party metadata APIs (external dependency, privacy,
  offline failure).

## 4. Local preservation — self-contained HTML for pages, original PDF for PDFs

- **Decision**: Detect content type first. For a PDF (by `Content-Type:
  application/pdf` or a `.pdf` that responds as PDF), stream the original bytes to
  `data/preserved/<id>.pdf` unchanged. For an ordinary page, render in Chromium
  and produce a **single self-contained HTML file** by inlining CSS, images (as
  data URIs), and fonts into one `.html` document saved to
  `data/preserved/<id>.html`.
- **Rationale**: Directly implements FR-026/FR-027. A single self-contained file
  is portable and openable offline with no sidecar assets. Chromium is already
  present, so no extra browser download (honoring "do not download a second
  browser version").
- **Alternatives considered**: MHTML (less portable/openable across viewers);
  WARC (archival-grade but heavy and not directly browser-openable); a directory
  of page + assets (not "self-contained", messier to move). Converting PDFs to
  HTML is explicitly rejected by the spec.

## 5. Internet Archive preservation (optional, best-effort)

- **Decision**: On user request, submit the URL to the Internet Archive "Save
  Page Now" endpoint and store the returned archived reference (snapshot URL) on
  the bookmark. Runs asynchronously; failures are recorded and surfaced but never
  block the save.
- **Rationale**: Implements FR-028/FR-029 and the external-dependency assumption.
  Decoupling it from save keeps the app responsive and resilient when the service
  is unavailable (expected in an offline review environment — reported honestly).
- **Alternatives considered**: Synchronous submission (blocks saves, violates
  FR-029); skipping it (drops a requested feature).

## 6. Search query language

- **Decision**: Hand-written tokenizer + recursive-descent parser producing a
  boolean AST, then translated to a parameterized SQLite `WHERE` clause.
  Rules encoded: case-insensitive matching; quoted `"exact phrase"`; `#tag`
  tokens constrain to a tag; `AND`/`OR`/`NOT` operators; parentheses for grouping
  with `NOT` > `AND` > `OR` precedence; **implicit AND** between adjacent terms
  (words and `#tag`) when no operator is written (FR-013a); `AND`/`OR`/`NOT`
  appearing inside quotes are literal text, not operators (FR-013b). Text terms
  match across address, title, description, notes, and tags.
- **Rationale**: A custom parser is the only reliable way to honor the exact,
  spec-defined semantics (implicit AND, quoted-operator-as-literal) — SQLite FTS5
  query syntax does not match these rules. AST→SQL keeps evaluation in the DB for
  speed at scale (SC-004).
- **Alternatives considered**: SQLite FTS5 MATCH (its operator/precedence and
  quoting rules differ from the spec; can't express #tag joins cleanly);
  in-memory JS filtering (simpler but slower and re-implements DB indexing);
  a parser-generator (unnecessary weight for this small grammar).

## 7. Rich (formatted) notes

- **Decision**: Author notes in Markdown (`markdown-it`); render to HTML for
  display and pass through `sanitize-html` with a conservative allowlist.
- **Rationale**: Markdown is a low-friction way to "contain formatting" (FR-025)
  and store as plain text; server-side sanitization prevents stored-HTML injection
  while rendering the formatting (US8). Note text remains searchable (FR-011).
- **Alternatives considered**: Store raw HTML from a WYSIWYG editor (sanitization
  still required, larger surface); plain text only (fails the formatting
  requirement).

## 8. Import / export format

- **Decision**: The Netscape Bookmark File format (the standard `<DL><DT><A>` HTML
  that Chrome/Firefox/Safari/Edge import and export). Parse with `cheerio`,
  reading `HREF`, link text (title), `TAGS` attribute (tags), and `ADD_DATE`
  (original date). Export emits the same structure.
- **Rationale**: This is the "standard browser bookmark file" the spec references
  (FR-030/FR-032); `ADD_DATE` preserves original dates (FR-030) and `TAGS`
  preserves tags. Import reconciles existing addresses via the same normalization
  + duplicate service, merging same-named tags (FR-031).
- **Alternatives considered**: JSON export (not a browser-interoperable standard);
  CSV (loses structure/tags semantics).

## 9. Address normalization & duplicate detection

- **Decision**: Normalize by lowercasing scheme and host, defaulting a missing
  scheme to `https://`, removing a redundant trailing slash on a path-less URL,
  and preserving path/query/fragment case. Store the normalized form as a UNIQUE
  key; a save or address-edit that collides routes the user to the existing
  bookmark in an editable state (never a copy, never a silent overwrite).
- **Rationale**: Implements FR-002/FR-007/FR-031 and SC-003. A UNIQUE column makes
  duplicate prevention a DB-level guarantee, not just app logic.
- **Alternatives considered**: Aggressive normalization (stripping query params /
  `utm_*`) — rejected as potentially merging genuinely different resources without
  the user asking.

## 10. Client architecture

- **Decision**: Framework-free vanilla JS single-page client served statically by
  Express, talking to the JSON API. Views: All, Unread, Archive, Saved Views,
  Preferences. List rows show title, description, tags, and site icon; activating
  a row opens the original page. Text-size preference applied via a root CSS
  variable/class.
- **Rationale**: One user and a modest number of views don't warrant a framework
  or build step; keeps startup to `npm start` with no compile. Rendering from the
  API keeps sort/filter/search responsive (SC-004).
- **Alternatives considered**: React/Vue SPA (build tooling, more deps for little
  gain here); server-side templated pages (more round-trips for interactive
  select/filter/sort).

## 11. Testing strategy

- **Decision**: `node:test` for unit (search parser, normalizeUrl, notes render,
  import/export) and integration (API routes against a temporary SQLite DB);
  `@playwright/test` pinned to `1.61.0` for an end-to-end smoke of save → tag →
  search → archive. Reuse the shared Chromium; do not download another revision.
- **Rationale**: The riskiest logic (search semantics, duplicate handling,
  import fidelity) is pure and deserves fast unit coverage; a thin e2e proves the
  wiring and the `data-harness-ready` marker.
- **Alternatives considered**: e2e-only (slow, poor at pinning down parser edge
  cases); no e2e (misses integration/readiness regressions).
