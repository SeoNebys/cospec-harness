# Phase 0 Research: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-24

The spec targets a single-user, browser-based v1 with durable local storage, no
accounts, no cross-device sync, and no external metadata fetching. Research below
resolves the technical unknowns needed to plan implementation within the provided
runtime image (Node.js 24, npm, Python, C/C++ toolchain, Playwright 1.61.0,
Chromium).

## Decision 1: Application architecture

- **Decision**: A single Node.js service (Express) that exposes a small JSON REST
  API under `/api/*` and also serves the static frontend from the same origin and
  port (4000).
- **Rationale**: Same-origin serving avoids CORS and cookie complexity, satisfies
  the single-port review requirement (`http://maker:4000`), and keeps the runnable
  surface to one `npm start` foreground command as required by the harness.
- **Alternatives considered**: Separate frontend dev server + backend (rejected:
  two ports, extra proxying, conflicts with the single-port review model);
  serverless/edge (rejected: no such runtime in the image).

## Decision 2: Persistence

- **Decision**: SQLite stored as a single file on disk (`data/bookmarks.db`),
  accessed via `better-sqlite3`.
- **Rationale**: Durable across restarts (satisfies FR-004, SC-002), needs no
  external database service (none is prescribed or guaranteed), synchronous API
  keeps request handlers simple, and the image's C/C++ toolchain can build the
  native module. Comfortably handles the ≤500 bookmark scale in SC-004.
- **Alternatives considered**: JSON flat file (rejected: no indexed search,
  concurrent-write corruption risk); Node 24 built-in `node:sqlite` (viable but
  still experimental and emits warnings — `better-sqlite3` is more battle-tested);
  PostgreSQL/MySQL (rejected: external service, over-scaled for single user).

## Decision 3: Frontend approach

- **Decision**: Vanilla HTML/CSS/JavaScript served as static assets, using
  `fetch` against the REST API. No build step / bundler.
- **Rationale**: The UI is modest (one list view with a save form, edit/delete,
  tag filter, search box). Avoiding a framework and build pipeline removes a whole
  class of toolchain risk, keeps the `start_command` to just starting the server,
  and keeps startup well within the 2s readiness target (SC-004).
- **Alternatives considered**: React/Vue with a bundler (rejected: build step and
  many dependencies for a small UI); server-rendered templates (rejected: heavier
  page reloads work against the "narrow as you type" search UX).

## Decision 4: Address validation & normalization

- **Decision**: Validate on the server using the WHATWG `URL` parser. If the input
  has no scheme, prepend `https://` before parsing. Accept only `http`/`https`
  results; reject everything else with a clear message.
- **Rationale**: Directly implements FR-002 and the "address without a scheme"
  edge case using a standard, dependency-free parser. Server-side validation is
  authoritative; the client mirrors it for fast feedback.
- **Alternatives considered**: Regex validation (rejected: brittle, poor edge-case
  coverage); accept-anything (rejected: violates FR-002).

## Decision 5: Safe display of user content

- **Decision**: Never render user-supplied text as HTML. On the frontend, insert
  titles, addresses, and tags via `textContent` / DOM node creation, and build
  target links by setting `href` to the stored (validated) URL. Set a restrictive
  `Content-Security-Policy` response header.
- **Rationale**: Implements FR-014 and the special-characters edge case; prevents
  stored-content injection without an HTML-sanitizer dependency.
- **Alternatives considered**: HTML-escape on the server then `innerHTML`
  (rejected: easy to get wrong; `textContent` is safe by construction).

## Decision 6: Testing strategy

- **Decision**: API/unit tests with Node's built-in `node:test` runner against the
  Express app (validation, CRUD, search/filter, duplicate warning). End-to-end UI
  tests with `@playwright/test` pinned to `1.61.0` driving Chromium, covering the
  P1 save + browse/open journeys and the edit/delete/search journeys.
- **Rationale**: `node:test` needs no extra dependency; Playwright is already in
  the image and the pin matches the installed browser revision (per project
  guidance). Covers each user story's independent test.
- **Alternatives considered**: Jest/Vitest (rejected: extra dependencies when the
  built-in runner suffices); manual testing only (rejected: no regression safety).

## Decision 7: Tag & search behavior

- **Decision**: Tags are stored per bookmark as a normalized set of lowercase,
  trimmed labels. Search is a case-insensitive substring match over title and
  address. Tag filter matches bookmarks carrying the selected tag. Search and tag
  filter combine with AND. Both are applied server-side via query parameters, with
  the client re-querying as the user types/selects.
- **Rationale**: Implements FR-009–FR-011 and their acceptance scenarios; keeps a
  single source of truth (the server) for what the list shows.
- **Alternatives considered**: Client-side-only filtering of a full fetch (viable
  at this scale but diverges from server-authoritative results; rejected for
  consistency and to keep SC-003 predictable as data grows).

## Resolved unknowns

All Technical Context items are resolved; no NEEDS CLARIFICATION markers remain.
