# Research: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-25 | **Phase**: 0

This document records the technical decisions that resolve the open choices in
the plan's Technical Context. Each entry states the decision, why it was chosen,
and the main alternatives considered.

## 1. Application shape and runtime

- **Decision**: One repository, one process: an Express server that exposes a
  REST API and serves a React SPA built by Vite. Run with `npm start` on
  `0.0.0.0:4000`.
- **Rationale**: The runtime presentation environment starts a single declared
  foreground command and expects port 4000. A single Node process serving both
  API and static assets satisfies this with no reverse proxy or multi-service
  orchestration. Node.js 24 and npm are provided by the image.
- **Alternatives considered**: Separate frontend/backend servers (rejected — two
  ports/processes complicate the harness contract); a server-rendered
  multi-page app (rejected — the UI is highly interactive: live search, bulk
  selection, tag autocomplete, saved views, so a SPA fits better).

## 2. Storage

- **Decision**: SQLite via better-sqlite3, single file at `data/bookmarks.db`.
  Binary captures (self-contained HTML, PDFs) stored as files under
  `data/captures/`, referenced by relative path from the database.
- **Rationale**: Single-user, local, durable across restarts (FR-029, SC-004)
  with zero external service to provision. better-sqlite3 is synchronous and
  simple, well suited to a single-process app. Keeping large blobs on disk keeps
  the database small and lets captures be served directly.
- **Alternatives considered**: JSON file store (rejected — weak for 500+ records
  with search/sort/bulk updates and concurrent writes); Postgres/MySQL
  (rejected — external service, unnecessary for one user); storing captures as
  DB blobs (rejected — bloats DB and complicates serving/streaming).

## 3. Metadata extraction (title, description, icon, preview)

- **Decision**: On URL entry, the server fetches the page HTML and parses it
  with cheerio, reading Open Graph / Twitter Card / standard meta tags
  (`og:title`/`<title>`, `og:description`/`meta[name=description]`,
  `og:image` for preview, and `<link rel=icon>` / OG image / `/favicon.ico` for
  the site icon). Results are returned for review; the user can edit any field
  (FR-002, FR-003). On failure, fall back to the address as title (FR-004).
- **Rationale**: cheerio is a lightweight, dependency-light HTML parser; a plain
  `fetch` (built into Node 24) avoids a heavy headless browser for the common
  case. Best-effort per the external-service boundary the client accepted.
- **Alternatives considered**: Always render with Playwright for metadata
  (rejected — slower and heavier than needed for meta tags); third-party
  metadata APIs (rejected — external dependency, privacy).

## 4. Self-contained HTML capture

- **Decision**: Capture a page as a single self-contained HTML file using the
  installed Chromium via Playwright: load the URL, then serialize the DOM with
  assets inlined (images/CSS as data URIs). Store under `data/captures/<id>.html`
  (FR-023). Detect PDFs by response content-type / URL and store the original
  bytes as `data/captures/<id>.pdf` instead of HTML (spec US9, FR-023).
- **Rationale**: The client explicitly wants a self-contained HTML file, not
  readable-text extraction. Playwright + Chromium is already installed with
  shared browser binaries, so no extra browser download (per the environment
  rules). Best-effort for login-only/highly-interactive pages, as agreed.
- **Alternatives considered**: `monolith` (Rust) or SingleFile CLI (rejected —
  extra binaries/downloads not guaranteed in the image; reuse installed
  Chromium instead); readability text extraction (rejected — client wants full
  self-contained HTML).
- **Note**: Pin `playwright`/`@playwright/test` to 1.61.0 in devDependencies so
  the browser revision matches the installed binaries; do not download a second
  browser version.

## 5. Internet Archive snapshot

- **Decision**: On request, POST the page URL to the Internet Archive Wayback
  "Save Page Now" endpoint and record the resulting snapshot URL when available
  (FR-024). Treat as fully best-effort: on any failure or unavailability, leave
  the bookmark intact and inform the user (FR-025).
- **Rationale**: Matches the client's optional-preservation request and the
  accepted external-service boundary. No credentials required for basic save.
- **Alternatives considered**: Bundling archiving into the local-capture step
  (rejected — client wants them as separate, independently requestable actions).

## 6. Search query language

- **Decision**: Implement a small tokenizer → parser → evaluator.
  - **Tokens**: bare terms, `#tag` tokens, `"quoted phrases"` (exact,
    case-insensitive substring match), operators `AND`/`OR`/`NOT`, and
    parentheses. An operator word inside quotes is a literal term (FR-009).
  - **Precedence**: NOT (highest) → AND → OR (lowest); parentheses override.
    Adjacent terms with no operator are treated as implicit AND.
  - **Fields**: case-insensitive match across title, address, description,
    notes (plain-text of the rich note), and tags; `#tag` restricts to tags
    (FR-008).
  - **Evaluation**: parse to an expression tree; evaluate against the candidate
    set (current state view). Report unbalanced quotes/parentheses as a clear
    error (edge cases, FR-009).
- **Rationale**: A hand-written recursive-descent parser gives exact control
  over the precedence and quoting rules the client pinned, and is small and unit
  testable. SQLite FTS5 alone cannot express NOT→AND→OR precedence with
  parentheses and literal-quoted operators as specified.
- **Alternatives considered**: SQLite FTS5 MATCH syntax only (rejected — its
  operator/precedence semantics differ from the pinned spec); a full parser
  library (rejected — overkill for this small grammar). FTS5 or an index may
  still be used underneath to shortlist candidates for performance (SC-003).

## 7. Import / export format

- **Decision**: Use the Netscape Bookmark File format (the `<DL><DT><A>` HTML
  that all mainstream browsers export/import). On import, map nested folder
  (`<H3>`) names to tags on the contained bookmarks, skip addresses that already
  exist, and report an added-vs-skipped summary (FR-021). On export, generate a
  standards-compliant file that browsers and this app can re-read (FR-022).
- **Rationale**: This is "the usual bookmark-file format" the client referred
  to; it round-trips across browsers and preserves address+title (SC-006).
  Folders-as-tags matches the client's confirmed intent and the folder-free
  design.
- **Alternatives considered**: JSON or CSV export (rejected — not what browsers
  read); per-browser proprietary formats (rejected — non-portable).

## 8. Rich-text notes

- **Decision**: Notes are edited with a lightweight formatting toolbar (bold,
  italic, lists, links) producing HTML; the server sanitizes the HTML on save to
  an allow-list of safe tags/attributes, and the UI renders the sanitized HTML
  when viewing (FR-026). A plain-text projection of the note feeds search.
- **Rationale**: Simple formatted text is exactly the scope; sanitization
  prevents stored-XSS from note content. Storing HTML keeps rendering trivial.
- **Alternatives considered**: Markdown storage + render (viable; rejected in
  favor of direct formatted editing so formatting shows as authored without a
  separate preview step); full rich-document editor (out of scope per spec).

## 9. States, bulk actions, saved views

- **Decision**: Model read/unread and archived as **two independent booleans**
  (`is_read`, `is_archived`) on the bookmark, with permanent delete as a
  separate hard removal (FR-016–FR-018). The three views are **derived filters**,
  not a stored state: normal = not archived; read-later = unread and not
  archived; archive = archived (any read state). Archiving flips only
  `is_archived`; restoring flips it back and touches nothing else, so an unread
  bookmark restored stays unread and reappears in the read-later view. Bulk
  actions accept either an explicit id list or a "select all matching the
  current query/filter" descriptor and apply add/remove-tags, read/unread,
  archive/restore, or delete (FR-019–FR-020). Saved views persist a search
  string plus included/excluded tag lists and are resolved live against the
  current collection (FR-014).
- **Rationale**: Read/unread status and visibility (archived) are genuinely
  independent concerns — the client requires that archiving and restoring never
  alter read/unread status. Two orthogonal booleans express every valid
  combination (e.g. archived-and-unread) that a single mutually-exclusive enum
  could not. Deriving the views keeps them consistent with the flags. Storing
  saved views as query+tag rules (not fixed id sets) keeps them live.
- **Alternatives considered**: A single `state` enum
  (`active`/`read_later`/`archived`) — **rejected**: it makes the states
  mutually exclusive, so an archived-and-unread bookmark cannot be represented
  and restoring would have to guess a read state, violating FR-017. Saved views
  as materialized bookmark lists (rejected — client wants live results).

## 10. Testing strategy

- **Decision**: Vitest unit tests for the pure, high-risk logic — search
  tokenizer/parser/evaluator (including precedence and quoted-operator cases),
  Netscape import/export mapping, and metadata extraction. Playwright Test
  (pinned 1.61.0) end-to-end tests covering the P1 stories (save with metadata;
  browse/search/sort) and key P2 flows (states, bulk, import/export).
- **Rationale**: The parser and format mappings are where correctness bugs hide
  and are cheap to test in isolation; e2e proves the user-visible flows against
  the real server. Pinning Playwright to 1.61.0 matches installed browsers.
- **Alternatives considered**: e2e-only (rejected — poor coverage of parser edge
  cases); unit-only (rejected — misses integration/UI regressions).

## Resolved unknowns

All Technical Context items are decided above; no `NEEDS CLARIFICATION` markers
remain. External-service behaviors (metadata fetch, HTML/PDF capture, Internet
Archive) are intentionally best-effort per the client-approved boundary.
