# Phase 0 Research: Bookmark Manager

Decisions resolving the open questions from the spec (chiefly the deferred platform choice) and
the technical unknowns implied by the requirements.

## 1. Platform: web / desktop / mobile

**Decision**: Local-first **web application** — a small local backend service plus a
browser-based frontend, run on the user's own machine.

**Rationale**:
- Several core requirements need a server-side fetcher: automatic page-metadata capture
  (FR-002), snapshot capture of pages and PDFs (FR-026), and optional archive submission
  (FR-027a). A browser cannot fetch arbitrary third-party sites due to cross-origin (CORS)
  restrictions, so a backend is *required*, not a nice-to-have.
- Opening bookmarks (FR-010) and reading snapshots is most natural in the browser the user
  already lives in.
- Local-first (local DB file + on-disk snapshots) satisfies "nothing lost between sessions"
  (SC-005) and keeps the app account-free and usable offline for everything already saved.

**Alternatives considered**:
- **Static browser-only app (no backend)**: rejected — cannot fetch page metadata, snapshots, or
  submit to an archive because of CORS; PDFs and durable snapshots have nowhere server-side to be
  captured.
- **Native desktop app (Electron/Tauri)**: viable and would also provide a backend process, but
  heavier to build and package for a solo v1. The local web app gives the same capabilities with
  a simpler footprint; a desktop shell can wrap the same code later if wanted.
- **Mobile app**: rejected for v1 — narrower screen for a management-heavy, bulk-editing,
  snapshot-reading workflow; and out of step with the single-user-local assumption. Revisit once
  the core is proven.

## 2. Language & stack

**Decision**: TypeScript end-to-end — Node.js backend (Fastify), React + Vite frontend.

**Rationale**: One language for a solo project reduces context switching; rich, well-supported
libraries exist for HTML parsing, readable-content extraction, and rich-text editing; Vite gives
a fast frontend dev loop.

**Alternatives considered**: Python backend (FastAPI) + JS frontend — perfectly capable, but
splits the codebase across two languages with no offsetting benefit here.

## 3. Storage & full-text search

**Decision**: SQLite (single local file) with the FTS5 full-text extension; snapshot files on
the local filesystem, referenced from the DB.

**Rationale**:
- SQLite is zero-administration, single-file, and ideal for a single-user local app; trivially
  meets the <1s search target for 1,000+ bookmarks (SC-004).
- FTS5 natively supports the exact search semantics the spec requires (FR-015): AND (multiple
  terms), OR alternatives, NOT exclusion, grouped conditions, and exact-phrase (quoted) queries —
  no bespoke query engine needed.
- Snapshots (potentially large HTML/asset bundles and PDFs) live on disk, not in the DB, keeping
  the database small and backups/inspection simple.

**Alternatives considered**: A client-side store (IndexedDB) — rejected, incompatible with the
local-backend requirement and weaker for the required query semantics. A server RDBMS
(Postgres) — overkill for one local user.

## 4. Automatic page metadata

**Decision**: Backend fetches the page and extracts title, description, and preview image from
Open Graph / Twitter Card / standard `<meta>` tags, and the site icon from the page's declared
icon / `/favicon.ico`. Fetch is asynchronous so saving is never blocked (SC-001); on failure the
bookmark still saves with an address-derived fallback title (FR-004).

**Rationale**: Open Graph and standard meta tags are the de-facto source for title/description/
preview across the web; this is a well-trodden extraction path.

## 5. Snapshots (web pages and PDFs)

**Decision**: For a web page, capture the readable main content (Readability-style extraction)
plus enough assets to render it, and store it in the snapshot store. For a PDF link, store the
original PDF file as-is (FR-026). Record snapshot availability per bookmark; when capture is not
possible (login-only/uncapturable), mark it unavailable without blocking the save (FR-027).

**Rationale**: Readable-content capture is robust to link rot and keeps snapshots small, which
matches the user's intent ("still read it later"); for PDFs the file itself is the best possible
snapshot. Content-type detection at fetch time decides which path applies.

**Alternatives considered**: Full-fidelity page archiving (headless-browser rendering of the
entire page including scripts) — heavier and out of scope per the spec's "not pixel-perfect"
assumption; can be added later without changing the data model.

## 6. Optional public web-archive submission (FR-027a)

**Decision**: Provide an opt-in setting to also submit a saved page's address to a public web
archive's "save page" endpoint. Runs in the background; any failure is logged and never blocks
saving or the local snapshot.

**Rationale**: Fully additive second safety net; isolating it behind an opt-in and a background
job keeps the core save path unaffected and makes it safely deferrable.

## 7. Import / export

**Decision**: Import and export the standard Netscape bookmark HTML format that browsers use for
export/import. On import, apply the same normalize-and-dedupe rule as manual saving so no
duplicates are created (FR-030); reject malformed files with a clear message importing nothing
(FR-031).

**Rationale**: The Netscape bookmark file is the common interchange format across all major
browsers, directly satisfying "bring in a bookmarks file browsers give you."

## 8. Duplicate detection / address normalization

**Decision**: Normalize addresses before comparison (scheme, host casing, default ports,
trailing-slash, and common tracking-parameter handling) and treat matches as the same bookmark;
saving a duplicate opens the existing one for editing (FR-006).

**Rationale**: Normalization is what makes "trivially different forms of the same URL" resolve to
one bookmark, as agreed in the spec.

## 9. Rich-text notes

**Decision**: A small rich-text editor supporting a common subset — headings, bold/italic, lists
— stored in a portable structured form and rendered back on view (FR-020).

**Rationale**: Matches the agreed "basic formatting, not a full document editor" scope while
preserving formatting reliably.

## 10. Testing approach

**Decision**: Unit tests (Vitest) for services (normalize/dedupe, metadata extraction, search
query building, import parsing); API integration tests for endpoints; Playwright E2E for the key
user journeys (save→list→open→snapshot, search, read-later, archive, bulk, import/export).

**Rationale**: Covers the pure logic, the contract, and the end-to-end flows that map to the
spec's acceptance scenarios.
