# Research & Decisions: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16
**Purpose**: Resolve technical unknowns before design. Each decision below feeds
the Technical Context in `plan.md`.

## R1 — Client-only vs. client + server

- **Decision**: Build a **web application with a small server component** (single
  Node.js process serving both a built browser UI and a JSON API), all running on
  the user's own machine.
- **Rationale**: Three approved requirements cannot be met by a browser alone:
  - **FR-003** automatic metadata capture — browsers block cross-origin reads of
    arbitrary pages (CORS); the server must fetch the page.
  - **FR-032** self-contained HTML / PDF snapshots — requires fetching the page
    and all its sub-resources, again cross-origin.
  - **FR-033** Internet Archive saving — a cross-origin POST to archive.org.
  A local server sidesteps CORS and gives durable local storage. "Same-device
  persistence" (FR-039) is satisfied because the server and its database live on
  the same device the user runs the app on.
- **Alternatives considered**: Pure client-side SPA with IndexedDB (rejected:
  cannot fetch metadata/snapshots/archive.org); browser extension (rejected:
  out of scope per spec, and heavier to distribute).

## R2 — Backend runtime & framework

- **Decision**: **Node.js 24 + Express** for the API/static server.
- **Rationale**: Node 24 and npm are provided by the runtime image; Express is
  minimal, ubiquitous, and easily serves both static assets and JSON routes on
  `0.0.0.0:4000` via `npm start` as the delivery environment requires.
- **Alternatives**: Fastify (fine, but no advantage here); a Python backend
  (rejected — keeps the stack single-language with the React UI).

## R3 — Storage

- **Decision**: **SQLite via `better-sqlite3`** for structured data; the
  **local filesystem** for snapshot files and cached favicon/preview images,
  referenced by path from the database. All under a `data/` directory.
- **Rationale**: Single-user, same-device → a file-backed embedded database is
  the simplest durable option, needs no separate service, and comfortably meets
  the scale targets (500+ bookmarks, bulk on 100+, sub-second — SC-006/008).
  `better-sqlite3` is synchronous and simple. Binary blobs (snapshots, images)
  live on disk to keep the DB small and streaming cheap.
- **Alternatives**: JSON file (rejected: no indexed search/atomicity at scale);
  Postgres (rejected: needs a separate service, over-scaled for single user).

## R4 — Frontend

- **Decision**: **React + Vite**, built to static assets served by the Express
  server. Markdown rendered with **`marked`** and sanitized with
  **`DOMPurify`** (via `jsdom` on server or in-browser).
- **Rationale**: The UI is interaction-heavy (live search, multi-select bulk,
  tag-suggest, markdown note preview, saved searches, preferences) which suits a
  component SPA. Vite builds to static files the single Node process can serve,
  keeping one server on one port. `marked`+`DOMPurify` is the standard safe path
  for FR-007 Markdown notes.
- **Alternatives**: Server-rendered templates (rejected: clunky for the rich
  client interactions); heavier frameworks (unnecessary).

## R5 — Automatic metadata capture (FR-003/005)

- **Decision**: On save, the server fetches the page and extracts title,
  description, favicon, and preview image from **OpenGraph/Twitter/`<meta>`/`
  <title>`/`<link rel=icon>`** using **`cheerio`**. Favicon and preview image are
  **downloaded and cached locally** (best-effort) so the list works offline and
  survives link rot; on failure, fall back to remote URL, then to a placeholder.
  Fetching runs **asynchronously**: the bookmark is created immediately with
  `metadata_status = pending`, and the UI shows a spinner until it flips to
  `complete` or `failed` (edge case: slow/failed fetch).
- **Rationale**: Matches FR-003/005 and the "not blocked indefinitely" edge case.
  `cheerio` is a lightweight server-side HTML parser. A fetch timeout (~10s)
  bounds latency.
- **Alternatives**: Headless-browser render for every save (rejected: too heavy
  for simple metadata; reserved for snapshots).

## R6 — Snapshots (FR-032)

- **Decision**: Detect the target's content type. **PDF** (or other non-HTML
  binary) → download and store the original file as-is. **HTML page** → render
  with **Playwright 1.61.0 / Chromium** (already in the image) and produce a
  **single self-contained HTML file** by inlining CSS, images, and fonts as
  `data:` URIs. Store under `data/snapshots/`, one file per snapshot, referenced
  by the DB. Served back via a snapshot endpoint for offline reopening.
- **Rationale**: Playwright is provided and pinned to 1.61.0 (its browser
  revision matches `/opt/playwright-browsers`), so it doubles as the snapshot
  engine and the E2E test driver without a second browser download. Inlining
  yields a truly portable single file (FR-032). Content-type detection cleanly
  separates the PDF-stays-PDF case.
- **Alternatives**: `monolith` (Rust) or `single-file-cli` (rejected: extra
  toolchain/deps when Playwright already covers it); MHTML (rejected: not a
  single portable HTML file, weaker cross-viewer support).

## R7 — Internet Archive saving (FR-033/034)

- **Decision**: Server submits the URL to the Internet Archive **Save Page Now**
  endpoint (`https://web.archive.org/save/<url>`) and records the resulting
  archived snapshot URL on the bookmark. Failures (service unreachable, rate
  limit) are surfaced as **recoverable** and retryable; the bookmark is untouched.
- **Rationale**: Directly implements FR-033/034. This is an external service, so
  the spec's honesty rule applies: if archive.org is unreachable during a review,
  we report it rather than fake success.
- **Alternatives**: Store archive.org's availability-API timestamp URL
  (secondary; can enrich later).

## R8 — Search grammar (FR-018–024)

- **Decision**: A small purpose-built query language, parsed by a hand-written
  tokenizer + recursive-descent parser into an expression tree, then evaluated
  against the candidate set. Grammar (see `contracts/search-grammar.md`):
  bare words = case-insensitive substring over title/description/note/url;
  `"quoted phrase"` = case-insensitive exact phrase; `#tag` = tag membership;
  `AND`/`OR`/`NOT` (bare, uppercase) = boolean operators; parentheses group;
  adjacency = implicit AND (so `#tag word` requires both — FR-020); `AND`/`OR`/
  `NOT` **inside quotes** are literal terms (FR-023). Invalid expressions
  (unbalanced parens, dangling operator) return a clear error, not a crash.
- **Rationale**: The required semantics (mixed tag/keyword, phrases, precedence,
  literal-when-quoted) exceed what SQL `LIKE`/FTS expresses directly, so an
  explicit parser is clearest and fully testable in isolation.
- **Alternatives**: SQLite FTS5 alone (rejected: awkward for `#tag`+boolean+
  literal-operator rules); regex hacks (rejected: unmaintainable). Candidate
  pre-filtering may still use SQL indexes; final boolean eval is in code.

## R9 — Tag identity (FR-008a)

- **Decision**: Tags are their own table with a **unique, case-insensitively
  normalized name** (trim + case-fold for identity; first-seen display casing
  preserved). Assigning an existing name reuses the same tag row via a join
  table; there is never a second row for the same name. Rename/delete/`#tag`
  search/click-to-filter therefore act on one identity.
- **Rationale**: Implements FR-008a and keeps it consistent with case-insensitive
  search (FR-018). Case-insensitive identity prevents `News` vs `news` duplicates.
- **Alternatives**: Case-sensitive tag names (rejected: would permit near-
  duplicates the client explicitly wants avoided).

## R10 — Netscape import/export (FR-035–037)

- **Decision**: Parse the standard Netscape bookmark file (`<DL><DT><A HREF ...
  ADD_DATE=... TAGS=...>`) with `cheerio`; map `HREF`→address, link text→title,
  `ADD_DATE`(epoch seconds)→date added, `TAGS` attribute (comma-separated, as
  browsers export)→tags. Export generates the same format with those attributes.
  Import de-duplicates by normalized URL (consistent with FR-006). A file that
  isn't a recognizable bookmark document is rejected whole (FR-037).
- **Rationale**: This is the format browsers actually produce/consume, giving the
  round-trip in SC-007. `ADD_DATE` and `TAGS` are the conventional attributes.
- **Alternatives**: JSON export (rejected: not what the client asked for; could
  be an additional format later).

## R11 — URL normalization & duplicate detection (FR-002/006)

- **Decision**: Normalize on input: add `https://` when scheme missing, reject
  non-http/https, lower-case host, strip default ports and fragments, keep path/
  query. Duplicate detection compares this normalized form. Saving a duplicate
  routes to the existing bookmark (FR-006).
- **Rationale**: Gives stable duplicate detection without over-normalizing
  (query strings can be significant, so they are kept).

## R12 — Testing approach

- **Decision**: **`node:test`** (built into Node 24, no dependency) for backend
  unit tests — the search parser, URL normalizer, and Netscape import/export are
  the highest-value pure-logic units. **Playwright 1.61.0** (`@playwright/test`,
  pinned) for end-to-end journeys through the running app.
- **Rationale**: Pinning Playwright to 1.61.0 matches the preinstalled browser
  revision (per project runtime notes), avoiding a second browser download.
  Pure-logic units are cheapest and most valuable to cover first.
- **Alternatives**: Vitest/Jest (rejected: extra deps; `node:test` suffices).

## R13 — Delayed metadata must never overwrite user input (FR-004/005)

- **Decision**: Track per-field ownership with `title_user_set` and
  `description_user_set` flags on the bookmark. Any user-supplied value — typed in
  the save form **or** edited afterward, including while the automatic fetch is
  still running — sets the corresponding flag. The async metadata worker fills
  `title`/`description` with a **conditional write** guarded on the flag
  (`... WHERE id=? AND title_user_set=0`), so it only ever populates fields the
  user has not customized. Favicon and preview (no user-entered equivalent)
  always fill. This closes the race where a fetch that started before an edit
  completes after it.
- **Rationale**: FR-004 requires user edits to win over auto-fetched values;
  because the fetch is asynchronous (R5), "last write wins" is unsafe — a slow
  fetch could land after the user's edit. Per-field flags + a conditional update
  make the fill idempotent and race-safe without locking. This is explicitly
  unit-tested (a fetch resolving *after* a simulated user edit must not change
  the field) plus an E2E check.
- **Alternatives**: Compare-against-fetched-value heuristics (rejected: fragile —
  a user might legitimately type the same text); global row lock during fetch
  (rejected: needless contention, worse UX than per-field flags).

## Resolved unknowns

All Technical Context items that would otherwise read NEEDS CLARIFICATION
(language, dependencies, storage, testing, platform, project type, performance,
constraints, scale) are resolved by R1–R12 above.
