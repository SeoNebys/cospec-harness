# Phase 0 Research: Bookmark Manager

All Technical Context items are resolved; no NEEDS CLARIFICATION remain. Each
decision below records what was chosen, why, and the main alternatives weighed.

## 1. Application stack & runtime shape

- **Decision**: Single Node.js 24 service using Express, serving both a JSON API
  and server-rendered HTML, started with `npm start` on `0.0.0.0:4000`.
- **Rationale**: The runtime requires one foreground process on port 4000; a
  single deployable is the simplest thing that satisfies it. Node 24 is provided
  by the image. Single-user scope does not justify a separate SPA build/service.
- **Alternatives**: SPA (React/Vue) + separate API — rejected as unnecessary
  build complexity for one user; Python/Flask — Node keeps one toolchain shared
  with Playwright Node and the `npm start` contract.

## 2. Persistence

- **Decision**: Embedded SQLite via `better-sqlite3`, one file under `data/`,
  with a simple forward-only migrations runner. Preserved page copies stored as
  files under `data/pagecopies/`, referenced by a column.
- **Rationale**: Zero external services (the image does not prescribe a DB),
  durable across restarts (SC-005), synchronous API keeps request handlers simple,
  and it easily handles low thousands of rows well under the performance targets.
  Large binary page copies live on disk, not in the DB, to keep it lean.
- **Alternatives**: JSON flat files — rejected: weak querying/concurrency for
  search and bulk ops; Postgres/MySQL — rejected: needs a server, over-scoped.

## 3. Metadata capture (title, description, favicon, preview)

- **Decision**: Fetch the page and read standard metadata: `<title>`, meta
  `description`, Open Graph (`og:title`, `og:description`, `og:image`), Twitter
  card fallbacks, and favicon (`<link rel="icon">` with `/favicon.ico` fallback).
  Use a plain HTTP fetch + `cheerio` first; fall back to Playwright/Chromium
  rendering when a page needs JS to expose metadata.
- **Rationale**: Covers the common cases cheaply, with a rendering fallback for
  JS-heavy pages. Best-effort per FR-005: any field may be absent and the
  bookmark still saves; failures are reported without blocking (edge cases).
- **Alternatives**: Always render with Chromium — rejected: slower and heavier
  for the majority of static pages; third-party metadata API — rejected: adds an
  external dependency and privacy exposure.

## 4. Search query grammar & evaluation

- **Decision**: Hand-written tokenizer + recursive-descent parser producing an
  AST, evaluated against each bookmark's searchable fields. Grammar: bare words,
  `"quoted phrases"`, `#tag` terms, `AND`/`OR`/`NOT`, and parentheses.
  Adjacent terms are implicitly ANDed unless joined by `OR` (FR-010a); an
  operator word inside quotes is a literal, not an operator (FR-010b);
  case-insensitive across title, URL, description, note, and tags (FR-009);
  malformed queries return a clear error (FR-011).
- **Rationale**: The spec's exact semantics (implicit-AND, quoted-operator-as-
  literal, `#tag` field targeting) are custom and not what a stock full-text
  engine gives by default; a small dedicated parser makes them precise and
  testable. At low-thousands scale, evaluating the AST in-process (optionally
  narrowed by an indexed tag pre-filter) is well within the "instant" target.
- **Alternatives**: SQLite FTS5 — rejected as the primary matcher: its MATCH
  syntax and default operator precedence don't match the required semantics and
  would need heavy translation; may still back plain-substring speedups later.

## 5. Single-file page preservation & PDF handling

- **Decision**: Detect content type. For HTML, render in Chromium (Playwright)
  and produce a **self-contained single HTML file** by inlining CSS, images, and
  fonts as data URIs (readable offline; not pixel-perfect/interactive, per the
  approved decision). For URLs that are PDFs, download and store the PDF as-is.
- **Rationale**: Playwright/Chromium is already installed; inlining resources
  yields one portable file that opens offline (FR-021, SC-007). Matches the
  approved scope: readable, not fully interactive.
- **Alternatives**: MHTML — rejected: less universally openable than a single
  HTML file; server-side "print to PDF" for all pages — rejected: the user asked
  for readable HTML copies for web pages and PDFs only when the source is a PDF.

## 6. Internet Archive submission

- **Decision**: Submit the URL to the Internet Archive "Save Page Now" public
  endpoint and record the resulting snapshot link on the bookmark. Treat it as a
  best-effort external call with a timeout.
- **Rationale**: Satisfies FR-022; being external, unreachability is reported and
  never harms the bookmark (approved decision, edge cases, Assumptions).
- **Alternatives**: Bundling a local archiver only — rejected: user explicitly
  wants the Internet Archive option in addition to local copies.

## 7. Import / export (browser bookmark HTML)

- **Decision**: Parse and generate the Netscape-style bookmark HTML format with
  `cheerio`. Preserve titles, `ADD_DATE`/`LAST_MODIFIED` dates, and tags (carried
  in the format's `TAGS` attribute where present). On import, merge by URL rather
  than duplicating (FR-020); round-trip preserves data (SC-006).
- **Rationale**: This is the de-facto interchange format across major browsers;
  cheerio handles its loose HTML robustly.
- **Alternatives**: JSON-only export — rejected: not interoperable with browsers,
  which the user explicitly requires.

## 8. Markdown notes

- **Decision**: Store raw Markdown; render with `marked` and sanitize the output
  with DOMPurify (`jsdom`) before display.
- **Rationale**: FR-006 requires simple Markdown displayed formatted; sanitizing
  prevents stored-HTML injection from note content.
- **Alternatives**: Store rendered HTML — rejected: loses the editable source and
  complicates re-editing.

## 9. Sessions / review environment

- **Decision**: Single-user with no login; use a lightweight signed cookie only
  where session state (e.g., current selection) benefits, configured to work over
  plain HTTP in the review environment. Mark the primary UI element
  `data-harness-ready="true"` once initial UI and data have loaded.
- **Rationale**: Meets the review-environment cookie and readiness requirements
  without introducing authentication that the spec puts out of scope.
- **Alternatives**: Full auth — rejected: out of scope for v1.

## 10. Testing approach

- **Decision**: `node --test` unit tests for the search parser, metadata
  extraction, import/export round-trip, and note rendering; Playwright Test
  (pinned `1.61.0`) end-to-end for the primary journeys.
- **Rationale**: Matches image tooling; pinning to `1.61.0` keeps the browser
  revision aligned with `/opt/playwright-browsers` (no second download).
- **Alternatives**: Jest/Mocha — rejected: extra dependency vs. the built-in
  runner that already suffices.
