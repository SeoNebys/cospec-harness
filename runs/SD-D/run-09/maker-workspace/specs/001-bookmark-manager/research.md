# Research: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-18 | **Phase**: 0

This document resolves the technical unknowns implied by the specification and
records the decisions that shape the plan. Choices are constrained by the shared
runtime image (Node.js 24, npm, Python, Playwright 1.61.0 + Chromium at
`/opt/playwright-browsers`) and by the review environment (app must listen on
`0.0.0.0:4000` and start via `npm start`).

## Decision 1 — Application shape & language

- **Decision**: A single Node.js 24 web application. One process serves a JSON
  HTTP API and the built static frontend. Started with `npm start`, listening on
  `0.0.0.0:4000`.
- **Rationale**: Node is first-class in the image and satisfies the `npm start`
  contract directly. A single process avoids multi-service orchestration for a
  single-user app and keeps the review-environment footprint minimal. Chromium +
  Playwright (needed for snapshots) are already Node-friendly.
- **Alternatives considered**: Python/Flask backend — viable but Playwright
  snapshotting and the Netscape-format tooling are more idiomatic in Node, and it
  would split the toolchain. Separate frontend + backend services — unnecessary
  process/port complexity for one user.

## Decision 2 — HTTP framework

- **Decision**: Express 4 for the API and static file serving.
- **Rationale**: Minimal, ubiquitous, stable, easy to test with Supertest; no
  build magic. Serving the built frontend from the same app keeps one port.
- **Alternatives considered**: Fastify (faster, heavier ecosystem churn) —
  performance is not the constraint here; Next.js/full framework — more build
  surface and conventions than this scope needs.

## Decision 3 — Persistence

- **Decision**: SQLite via `better-sqlite3`, one database file under a `data/`
  directory. Snapshot files stored on disk under `data/snapshots/`, referenced by
  path in the DB.
- **Rationale**: Single-user, file-based, zero external services, durable across
  restarts (satisfies FR-034 / SC-010). `better-sqlite3` is synchronous and
  simple, ideal for this scale (thousands of bookmarks). Large binary snapshots
  belong on the filesystem, not in the DB, to keep it lean.
- **Alternatives considered**: JSON flat file — no transactional integrity or
  indexing, risks data loss on concurrent writes; Postgres — external service not
  warranted for one user; storing snapshots as BLOBs — bloats the DB and
  complicates serving files.

## Decision 4 — Search parsing & evaluation

- **Decision**: A small hand-written query parser producing a boolean AST, then
  evaluation in the application layer against each candidate bookmark's searchable
  text (title + description + note + address, lower-cased) and its tag set.
  Grammar: bare words = case-insensitive substring terms; `"quoted phrases"` =
  exact literal (operator words inside quotes are literal words); `#tag` = tag
  membership; `AND`/`OR`/`NOT` (unquoted) = operators; parentheses group. Adjacent
  terms without an explicit operator combine with AND, so free text plus `#tag`
  requires both to match (FR-015).
- **Rationale**: Owning the parser gives exact, testable control over the two
  subtle rules the client called out (text + `#tag` ⇒ AND; quoted operator words
  are literals) that off-the-shelf engines get wrong or express awkwardly.
  Application-side evaluation over a candidate set is trivially correct and, at
  ≤1,000–a few-thousand rows, comfortably meets the <1s target (SC-003).
- **Alternatives considered**: SQLite FTS5 `MATCH` — supports AND/OR/NOT and
  phrases but its tokenizer and operator handling do not cleanly express
  "quoted AND is a literal word" or mixing `#tag` set-membership with text; would
  need pre/post-processing anyway. Kept as a future optimization (an FTS index can
  pre-filter candidates) if scale grows. Malformed queries (unbalanced quote/paren)
  surface a clear error (FR-016).

## Decision 5 — Automatic page metadata (title, description, favicon, preview) — collected **before** commit

- **Decision**: Metadata is collected **synchronously, up front, for the person to
  review and edit before the bookmark is committed** (matching spec US1 scenario 1).
  The flow is two steps:
  1. **Prepare/preview** (no persistence): given the URL, fetch the target with a
     plain HTTP request (short, bounded timeout — see below) and parse the returned
     HTML with Cheerio for `<title>`, meta description / `og:description`, `og:image`
     (preview), and favicon (`<link rel="icon">`, fallback `/favicon.ico`). Resolve
     relative asset URLs to absolute. Return these for review.
  2. **Commit**: the person reviews/edits title and description, then saves; the
     **reviewed values are what get persisted**.
- **Fetch timeout / fallback**: the prepare fetch uses a bounded timeout (target
  ~8s, comfortably inside the 15s save budget of SC-001). If the page cannot be read
  promptly (timeout, offline, blocked), prepare returns **fallback details**
  (title derived from the page/host, empty description) so the person can continue
  and save immediately, then edit later (FR-007).
- **Rationale**: A simple GET + Cheerio is fast enough to fit inside the save
  budget while giving the person the automatically collected details to confirm or
  change before committing — the experience the client approved. Only the slower
  snapshot capture is deferred to the background (Decision 6/11).
- **Alternatives considered**: Collecting metadata asynchronously after create —
  **rejected**: it hides the details until after commit and contradicts the
  approved "review before saving" experience. Rendering every page in Chromium for
  metadata — slower/heavier than needed; reserve Chromium for snapshots.
  Third-party metadata APIs — external dependency and privacy cost for a local app.

## Decision 6 — Local snapshots (self-contained single HTML; PDFs as PDFs)

- **Decision**: Determine the target's content type first. If it is a PDF
  (content-type `application/pdf` or a `.pdf` that responds as such), download the
  bytes and store as `data/snapshots/<id>.pdf`. Otherwise render the page in
  headless Chromium via Playwright and produce a **self-contained single HTML
  file** (all CSS, images, and fonts inlined as data URIs) stored as
  `data/snapshots/<id>.html`. Use the `single-file-cli` (SingleFile) engine driven
  by the pre-installed Chromium, pinned to the shared browser revision. Capture
  runs asynchronously; status is tracked as pending → available/unavailable
  (FR-029, FR-031).
- **Rationale**: SingleFile is the established tool for producing standalone HTML
  with inlined assets and already uses a Chromium engine, matching FR-029 exactly.
  Reusing the image's Chromium avoids a second browser download (per image
  guidance). PDF passthrough is a simple byte copy, honoring "PDFs as PDFs".
- **Alternatives considered**: `monolith` (Rust) — not in the image and would add
  a toolchain; Playwright's `page.pdf()` to snapshot pages as PDF — contradicts the
  "single HTML file" requirement for web pages; naive HTML save without inlining —
  breaks when the origin changes (fails SC-006 durability).
- **Playwright pinning**: pin `playwright`/`@playwright/test` to `1.61.0` in
  devDependencies so the browser revision matches `/opt/playwright-browsers`; do
  not download a second browser.

## Decision 7 — Internet Archive preservation

- **Decision**: On explicit request per bookmark, submit the URL to the Internet
  Archive "Save Page Now" endpoint (`https://web.archive.org/save/<url>`), follow
  the response to the resulting `https://web.archive.org/web/<timestamp>/<url>`
  snapshot URL, and store that link on the bookmark. Treat it as optional and
  best-effort: if the service is unreachable, report it and leave the rest of
  saving unaffected (FR-030, Assumptions).
- **Rationale**: Save Page Now is the standard public mechanism; storing just the
  returned link keeps our storage small and defers durability to the Archive.
- **Alternatives considered**: Auto-archiving every bookmark — slow, rate-limited,
  and often unwanted; the spec makes it an explicit per-bookmark action.

## Decision 8 — Netscape bookmarks import/export

- **Decision**: Parse and generate the classic **Netscape Bookmark File Format**
  (the `<DL><DT><A HREF ... ADD_DATE ...>` structure mainstream browsers use).
  Import: map each `<A>` to a bookmark, preserving title, href, and `ADD_DATE`
  (epoch seconds → stored date), and map enclosing `<H3>` folder names to tags;
  skip addresses already present (by normalized URL) and report added-vs-skipped
  (FR-026, FR-027). Export: emit the same format with tags rendered as folders and
  original dates preserved (FR-028). Parse with Cheerio; generate with a small
  serializer.
- **Rationale**: This is the format the client confirmed and that Chrome/Firefox/
  Safari/Edge round-trip. Cheerio handles the loose historical HTML robustly.
- **Alternatives considered**: A dedicated npm bookmark-parser — most are
  unmaintained or lossy on folders/dates; a focused parser we control guarantees
  the fidelity SC-004/SC-005 demand.

## Decision 9 — URL normalization & de-duplication

- **Decision**: Normalize by adding a missing scheme (default `https://`),
  lower-casing the host, removing a trailing slash on an empty path, and stripping
  a default port. Keep path/query case-sensitive. De-duplicate on the normalized
  form; re-saving a match opens the existing bookmark for editing (FR-005, FR-006).
- **Rationale**: Matches the spec's "trivial variations are the same page" without
  over-normalizing (query strings can be significant).
- **Alternatives considered**: Aggressive normalization (dropping query, fragments,
  `www.`) — risks merging genuinely different pages.

## Decision 10 — Frontend approach

- **Decision**: A single-page app built with React + Vite, compiled to static
  assets that Express serves. Client-side routing for the views (All, Unread,
  Archived, Bookmark edit, Filters, Preferences). Markdown notes rendered with a
  small, sanitized Markdown renderer (`marked` + DOMPurify) on view (FR-010).
- **Rationale**: React + Vite is a standard, well-understood stack; Vite builds
  ahead of time so `npm start` only serves prepared assets (per review-env rules).
  Sanitizing rendered Markdown avoids injecting untrusted note/HTML content.
- **Alternatives considered**: Server-rendered templates + htmx — leaner but makes
  bulk-selection, tag type-ahead, and live Markdown preview more awkward; a
  no-build vanilla SPA — saves a build step but costs maintainability across ten
  interactive stories.

## Decision 11 — What runs in the background (snapshot only) & the no-overwrite rule

- **Decision**: The **only** background work is snapshot capture (Decision 6).
  Metadata is resolved before commit (Decision 5), so creating a bookmark persists
  the reviewed title/description/favicon/preview immediately, then enqueues snapshot
  capture in a lightweight in-process queue that updates `snapshotStatus`
  (`pending` → `available`/`unavailable`).
- **No-overwrite rule (hard constraint)**: Background jobs MUST NEVER modify the
  `title` or `description` of a bookmark. Snapshot capture writes only
  `snapshotType`, `snapshotStatus`, and `snapshotPath` (and, only if still empty,
  `faviconPath`/`previewImagePath`). This guarantees that any value the person
  entered or edited is never clobbered by later background work (client requirement).
- **Rationale**: Keeps save fast for the person while honoring "review details
  before commit"; capturing a self-contained snapshot can be slow, so it is the
  only thing deferred. Restricting background writes to snapshot-related fields is
  the simplest robust way to make overwrites structurally impossible.
- **Alternatives considered**: A field-level "user-edited" provenance flag so
  background jobs could still refine untouched fields — more moving parts than
  needed; simply forbidding background writes to title/description is safer and
  clearer. Doing snapshots synchronously on save — would blow the 15s budget on
  slow pages.

## Decision 12 — Testing strategy

- **Decision**: Vitest for unit tests (search parser/evaluator, URL normalizer,
  Netscape import/export, metadata parsing) and API tests via Supertest;
  Playwright 1.61.0 for a small set of end-to-end flows (save → list → search →
  edit → archive). Network-dependent steps (live fetch, Internet Archive) are
  stubbed against local fixtures in tests.
- **Rationale**: The tricky, high-value logic (search semantics, format fidelity)
  is pure and unit-testable; E2E covers the integrated happy paths. Pinning
  Playwright to 1.61.0 keeps the browser revision aligned with the image.
- **Alternatives considered**: E2E-only — slow and poor at pinning search-grammar
  edge cases; no browser tests — misses integration regressions.

## Open items

None. All specification points map to a decision above; no `NEEDS CLARIFICATION`
remain.
