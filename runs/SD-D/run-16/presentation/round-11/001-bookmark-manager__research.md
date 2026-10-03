# Phase 0 Research: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-24

This document resolves the open technical decisions implied by the approved spec,
constrained by the project's runtime environment (Node.js 24, Python, C/C++ toolchain,
Playwright 1.61.0 + shared Chromium at `/opt/playwright-browsers`, review served on
port 4000 via `npm start` bound to `0.0.0.0`).

## Decision 1 — Application architecture

- **Decision**: A single Node.js web application: an HTTP server exposing a JSON REST
  API plus a static single-page frontend (no build/bundler step), started with
  `npm start`.
- **Rationale**: Single-user, no-login scope (spec Assumptions) makes a heavy
  frontend framework and separate backend deployment unnecessary. A no-build vanilla
  frontend keeps the lockfile small, avoids a second toolchain, and is trivial to
  serve on port 4000 as the harness requires.
- **Alternatives considered**: (a) React/Vite SPA — rejected: adds a build step and
  larger dependency surface for no user-facing benefit at this scale. (b) Fully
  server-rendered multi-page app — rejected: the rich interactions (live search, bulk
  multi-select, tag autocomplete, text-size preference) are cleaner as client-side
  state over a JSON API.

## Decision 2 — Web framework

- **Decision**: Express 4.
- **Rationale**: Minimal, stable, well-understood routing and static file serving;
  easy to bind to `0.0.0.0:4000`. Ample for a single-user API.
- **Alternatives considered**: Fastify (fine, but no advantage here); raw `http`
  module (more boilerplate for routing/static/JSON).

## Decision 3 — Storage

- **Decision**: SQLite via `better-sqlite3`, one database file under a `data/`
  directory; preserved page copies and PDFs stored as files under `data/preserved/`
  referenced by path from the DB.
- **Rationale**: Durable, transactional, zero-configuration, and a single file is the
  natural fit for a personal single-user app requiring zero data loss across restarts
  (SC-004). `better-sqlite3` is synchronous, simplifying correctness of bulk
  operations and transactions. Large binary artifacts (preserved HTML, PDFs) live on
  disk rather than as blobs to keep the DB lean and backups simple.
- **Alternatives considered**: (a) JSON flat file — rejected: unsafe for concurrent
  writes and bulk updates, and no query engine. (b) Postgres/MySQL — rejected:
  operational overhead unjustified for one local user. (c) Storing preserved copies as
  DB blobs — rejected: bloats the DB and complicates viewing files directly.

## Decision 4 — Search query parsing and evaluation

- **Decision**: A small custom query parser that tokenizes the query and builds an
  AST, then evaluates it against candidate records in the service layer. Grammar:
  quoted `"exact phrase"`, `#tag` terms, boolean `AND`/`OR`/`NOT` (case-insensitive
  keywords) with parentheses, implicit **AND** between adjacent terms, and quoted
  operator words treated as literal text. Free-text terms match case-insensitively
  across title, description, note, and address; `#tag` terms match the tag set.
  Archived bookmarks are excluded from normal search by a pre-filter.
- **Rationale**: The spec's grammar (FR-008–FR-010) mixes full-text terms with tag
  membership and boolean logic including a literal-operator rule — this is not
  expressible directly in SQLite FTS5 syntax without leaking FTS quirks to the user. A
  purpose-built parser makes the exact semantics testable and keeps behavior identical
  to the acceptance scenarios. At personal scale (SC-002/SC-003: 500+ bookmarks under
  1s) evaluating an AST over in-memory rows loaded from SQLite is comfortably fast.
- **Alternatives considered**: (a) SQLite FTS5 MATCH — rejected: its boolean/phrase
  syntax and tokenizer differ from the spec's grammar (e.g., literal quoted operators,
  `#tag` semantics) and would surface confusing edge behavior. (b) A parser generator
  — rejected: the grammar is small enough for a hand-written recursive-descent parser.

## Decision 5 — Page detail capture (title, description, icon, preview image)

- **Decision**: On save, the server fetches the target URL and parses HTML metadata
  with `cheerio`: `<title>`/OpenGraph `og:title`, `og:description`/meta description,
  favicon (`<link rel="icon">` variants, fallback `/favicon.ico`), and preview image
  (`og:image`/`twitter:image`). Absolute URLs are resolved; on failure the address is
  used as the fallback title (FR-003).
- **Rationale**: OpenGraph/meta parsing is the standard, lightweight way to obtain
  these details and covers the majority of sites without rendering. `cheerio` is a
  small, well-known server-side HTML parser reused for import/export too.
- **Alternatives considered**: Rendering every page with headless Chromium to read
  metadata — rejected as unnecessary weight for the common case; rendering is reserved
  for preservation (Decision 6).

## Decision 6 — Offline preservation (single self-contained HTML) and PDFs

- **Decision**: For web pages, preservation renders the page with the shared Chromium
  (the already-installed Playwright browser) and serializes it to a **single
  self-contained HTML file** with CSS, images, and fonts embedded as data URIs (no
  separate asset folder), stored under `data/preserved/`. The `single-file-cli`
  library is used, configured with `--browser-executable-path` pointing at the shared
  Chromium binary so **no second browser is downloaded** (per environment
  constraints). For addresses whose response is a PDF (content-type `application/pdf`
  or `.pdf`), the original PDF bytes are downloaded and stored as-is (FR-035).
- **Rationale**: SingleFile is the established solution for producing one embedded HTML
  file from a rendered page, directly satisfying the "single self-contained HTML file,
  no separate folder" requirement (FR-034, clarified). Reusing the shared Chromium
  respects the "do not download a second browser version" rule.
- **Alternatives considered**: (a) Hand-rolled asset inliner over Playwright
  `content()` — rejected: correctly rewriting `url()` references in CSS, srcset, and
  nested stylesheets is exactly what SingleFile already does robustly. (b) `monolith`
  (Rust CLI) — viable and self-contained, but adds a non-Node toolchain artifact;
  SingleFile keeps everything in the Node ecosystem and reuses the mandated Chromium.
- **Pin note**: `playwright` is pinned to `1.61.0` in devDependencies so any
  browser-driven tests match the installed browser revision.

## Decision 7 — Internet Archive snapshot

- **Decision**: The server submits the address to the Internet Archive "Save Page Now"
  endpoint (`https://web.archive.org/save/<url>`) and records the resulting snapshot
  URL (from the response `Content-Location`/`Location` or the resolved final URL) on
  the bookmark. Failures (unreachable/timeout/rate-limited) are reported to the user
  and leave the bookmark intact (FR-036, FR-037).
- **Rationale**: Save Page Now is the public mechanism for creating a new snapshot and
  returns the canonical archived URL, matching the clarified behavior (store the link,
  do not download).
- **Alternatives considered**: Availability API lookup of an existing snapshot —
  rejected: the clarification specifies creating a *new* snapshot.

## Decision 8 — Import / export (browser bookmark file)

- **Decision**: Support the Netscape bookmark HTML format used by major browsers.
  Export generates that format including `ADD_DATE` and `TAGS` attributes. Import
  parses it with `cheerio`, preserving each entry's title, tags, and original
  date-added; addresses already present are skipped; added/skipped counts are reported.
  Documented fallbacks: address as title, empty tags, import time as date-added
  (FR-031–FR-033, clarified).
- **Rationale**: The Netscape format is the universal interchange format ("common
  browser bookmark file"). `cheerio` already in use handles both parse and generate.
- **Alternatives considered**: JSON export only — rejected: not interoperable with
  browsers as the spec requires.

## Decision 9 — Markdown notes rendering

- **Decision**: Notes are stored as raw Markdown. On view, they are rendered to HTML
  with `marked` and sanitized with a DOM sanitizer (`DOMPurify` via `jsdom` on the
  server, or DOMPurify in the browser) before display (FR-038).
- **Rationale**: `marked` covers the required elements (headings, emphasis, lists,
  links, quotes, code); sanitizing prevents unsafe HTML from rendered Markdown.
- **Alternatives considered**: A full rich-text editor storing HTML — rejected by the
  clarification (Markdown authoring chosen).

## Decision 10 — Testing approach

- **Decision**: Unit and integration tests with Node's built-in test runner
  (`node:test`) plus `supertest` for HTTP API tests. The search parser, import/export,
  and metadata extraction get focused unit tests. `playwright@1.61.0` is available for
  a small number of end-to-end UI checks using the shared Chromium.
- **Rationale**: `node:test` needs no extra framework; `supertest` gives concise API
  assertions. Pinning Playwright to 1.61.0 keeps the browser revision aligned.
- **Alternatives considered**: Jest/Vitest — heavier dependency footprint than needed.

## Decision 11 — Preferences and saved searches persistence

- **Decision**: Display preferences (default sort, items shown, text size) and saved
  searches are stored in SQLite alongside bookmarks so they persist across restarts
  (FR-028, FR-029).
- **Rationale**: Single durable store; consistent backup story.
- **Alternatives considered**: Browser `localStorage` for preferences — rejected: the
  spec requires persistence tied to the app's data and testable server-side.

## Resolved unknowns

All Technical Context items are resolved; no `NEEDS CLARIFICATION` markers remain.
