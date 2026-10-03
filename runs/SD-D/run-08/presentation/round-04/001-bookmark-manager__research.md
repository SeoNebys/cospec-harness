# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the spec plus the runtime image
capabilities; there are no remaining NEEDS CLARIFICATION. Decisions below record
what was chosen, why, and the alternatives considered.

## 1. Runtime & language

- **Decision**: Node.js 24 with ES modules for both backend and frontend build.
- **Rationale**: The shared image provides Node.js 24, npm, Chromium, and Playwright
  1.61.0. A Node backend can drive Playwright directly for enrichment/snapshots and
  serve the built SPA, satisfying the `npm start` on `0.0.0.0:4000` convention with
  no extra runtime.
- **Alternatives**: Python + FastAPI (also available) — rejected because sharing one
  language across API, build, and browser automation is simpler here and avoids a
  second toolchain.

## 2. Persistence

- **Decision**: Embedded SQLite via `better-sqlite3`, with an FTS5 virtual table for
  full-text search. Binary artifacts (snapshots, PDFs, favicons, previews) stored on
  disk under `data/snapshots/`, referenced by relative path.
- **Rationale**: Single-user, no accounts → a server-managed relational store fits
  the entities (bookmarks, tags, saved views, preferences) and their many-to-many
  tag relationships. FTS5 gives sub-second search across title/description/note/
  address for thousands of rows (SC-004). Embedded = no external DB to run/review.
  Synchronous `better-sqlite3` keeps model code simple.
- **Alternatives**: JSON flat file (rejected: no efficient search/joins at scale);
  PostgreSQL (rejected: external service violates self-contained runtime); browser
  local storage only (rejected: server-side enrichment/snapshots need server
  persistence).

## 3. Metadata enrichment (title, description, favicon, preview)

- **Decision**: On save, fetch the page and extract Open Graph / Twitter Card / HTML
  `<title>`/`<meta name=description>` and favicon/preview. Use Playwright (Chromium)
  to render, with a lightweight `cheerio` HTML parse as the primary/fast path and
  Playwright as fallback for JS-rendered pages. Store favicon and preview image as
  files.
- **Rationale**: OG/Twitter tags are the standard source of title/description/preview
  (SC-002 ≥90% of typical pages). Chromium is already available; Playwright handles
  pages that require JS. Missing fields fall back gracefully (FR-005).
- **Alternatives**: Third-party unfurl APIs (rejected: external dependency, privacy,
  offline review); regex scraping (rejected: brittle vs. `cheerio`).

## 4. Local snapshot & PDF handling

- **Decision**: Capture a self-contained snapshot of each saved HTML page (rendered
  DOM + inlined or referenced assets, or a single-file HTML/MHTML) via Playwright.
  When the address's content type is PDF, download and store the PDF as-is rather
  than rendering. Snapshot capture runs asynchronously after the bookmark is created;
  failures are recorded and surfaced, never blocking the save (FR-041).
- **Rationale**: Playwright/Chromium can render and serialize pages and produce PDFs
  from HTML; PDFs are best preserved byte-for-byte. Async keeps the save fast
  (SC-001).
- **Alternatives**: Screenshot-only (rejected: loses selectable content); print-to-PDF
  for everything (rejected: real PDFs should stay PDFs per FR-039).

## 5. Internet Archive integration

- **Decision**: Optional per-bookmark action that submits the address to the Internet
  Archive "Save Page Now" endpoint and records the returned archived-copy reference.
  Runs out-of-band; any failure/timeout is caught and surfaced without affecting the
  local save (FR-040, FR-041).
- **Rationale**: Matches the spec's "option to save through the Internet Archive" and
  graceful-failure requirement. The review environment may lack external network; the
  feature degrades cleanly and the rest of the app is unaffected.
- **Alternatives**: Mandatory archiving on every save (rejected: spec says optional,
  and external calls must not gate saving).

## 6. Search query grammar & execution

- **Decision**: A small tokenizer + recursive-descent parser producing a boolean AST.
  Grammar: bare words (substring match across title/description/note/address,
  case-insensitive), `#tag` terms, `"quoted phrases"` (exact, and operator words
  inside quotes are literal text), operators `AND`/`OR`/`NOT` recognized
  case-insensitively, parentheses for grouping, and **implicit AND** between adjacent
  terms with no operator. The AST is compiled to a parameterized SQL query combining
  FTS5 matches for text and EXISTS/join conditions for tags; NOT becomes negation.
  Malformed queries (unbalanced quotes/parens) return a clear error.
- **Rationale**: Directly encodes FR-014–FR-018, FR-017a/b/c. A hand-written parser is
  small, fully testable, and avoids pulling in a heavy query-language dependency.
  Compiling to SQL keeps execution within the sub-second budget.
- **Alternatives**: SQLite FTS5's native query syntax alone (rejected: doesn't cover
  cross-field substring, `#tag`, implicit-AND semantics, or friendly error reporting);
  full parser-generator (rejected: overkill for this grammar).
- **Details**: See `contracts/search-grammar.md`.

## 7. URL normalization for duplicate detection

- **Decision**: Canonicalize before comparison: lowercase scheme and host, strip a
  default port, remove a trailing slash on the path, and treat otherwise-equal URLs
  as duplicates. Preserve the original address as entered for display/opening; store a
  normalized key for uniqueness.
- **Rationale**: Implements FR-006/FR-007 (trailing slash, host case). Keeping the
  original address avoids surprising the user while still preventing duplicates.
- **Alternatives**: Exact string match (rejected: client explicitly wants trivial
  differences merged); aggressive normalization stripping query/fragment (rejected:
  could merge genuinely different pages).

## 8. Markdown notes rendering (safe)

- **Decision**: Author notes in Markdown; render with `marked`, then sanitize the
  resulting HTML with `sanitize-html` (allowlist) before display. Store raw Markdown.
- **Rationale**: Satisfies FR-008 (formatted Markdown) and FR-009 (safe rendering, no
  interface hijacking). Sanitizing after render defends against script/style
  injection from notes and from fetched metadata alike.
- **Alternatives**: Trust rendered HTML (rejected: injection risk); custom mini-markup
  (rejected: client asked for Markdown).

## 9. Browser bookmark import/export

- **Decision**: Support the Netscape Bookmark File Format (the standard HTML export
  used by major browsers). On import, parse with `cheerio`, mapping folder structure
  and any tags to tags, and `ADD_DATE` to the original creation date; skip addresses
  already present (by normalized key) to avoid duplicates. Export produces the same
  HTML format preserving titles, tags, and dates.
- **Rationale**: One widely interoperable format satisfies FR-035–FR-037 and the
  client's confirmed choice. Reusing the normalization key gives duplicate-free import
  (FR-036).
- **Alternatives**: Per-browser JSON formats (rejected: fragmented, not requested).

## 10. Frontend approach

- **Decision**: React + Vite SPA, built to static assets served by Express. Client
  routing for the views; a typed API client module; components for tag input with
  suggestions, search bar, bulk-action bar, confirm dialogs, and Markdown note
  display.
- **Rationale**: The interactions (multi-select, view-wide bulk actions, type-ahead
  tag suggestions, saved views, live search) are stateful and benefit from a component
  model. Building to static assets keeps a single-process `npm start` deployment.
- **Alternatives**: Server-rendered templates (rejected: heavier for this much client
  interactivity); a larger meta-framework (rejected: unnecessary for a single-user
  app and adds runtime complexity).

## 11. Async work & readiness

- **Decision**: Saving returns immediately after the bookmark row is created; enrichment,
  snapshot, and optional Internet Archive run as background jobs that update the row
  and surface per-item status. The UI marks `data-harness-ready="true"` once the
  initial list (or a valid empty state) has loaded.
- **Rationale**: Meets SC-001 (fast save), FR-041 (non-blocking preservation), and the
  runtime readiness-marker convention.
- **Alternatives**: Synchronous enrichment on save (rejected: slow, and a slow/blocked
  fetch would stall the user).

## 12. Testing strategy

- **Decision**: `vitest` unit tests for the search parser (all grammar cases including
  implicit AND, case-insensitive operators, quoted-operator-as-text), URL
  normalization, and import/export mapping. Playwright Test (pinned 1.61.0) E2E for the
  prioritized user stories, using the shared browser binaries.
- **Rationale**: Pure logic with many edge cases is cheapest to protect with unit
  tests; user-visible flows are validated end-to-end. Pinning matches installed
  browsers per runtime guidance.
- **Alternatives**: E2E only (rejected: slow feedback on parser edge cases).
