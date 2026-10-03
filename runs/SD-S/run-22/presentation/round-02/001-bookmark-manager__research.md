# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the approved spec and the runtime
environment; no `NEEDS CLARIFICATION` markers remain. Decisions below record why
each choice was made.

## Decision: Runtime & language — Node.js 24 + JavaScript (ES modules)

- **Rationale**: The shared image provides Node.js 24 and npm; the review harness
  expects a Node-friendly `npm start`. JavaScript keeps the stack single-language
  across API and browser with no build/transpile step required.
- **Alternatives considered**: Python + Flask (also available, but adds a second
  language vs. the browser front end); TypeScript (adds a build step for marginal
  benefit at this scope).

## Decision: Web framework — Express

- **Rationale**: Minimal, well-understood routing and static-file serving in one
  small dependency; easy to mount the JSON API and serve `public/` from the same
  process on port 4000.
- **Alternatives considered**: Node built-in `http` (more boilerplate for routing
  and body parsing); Fastify (fine, but no advantage at this scope).

## Decision: Storage — SQLite via better-sqlite3

- **Rationale**: Spec requires local-only persistence surviving restarts (FR-004,
  SC-003) and responsiveness at 1,000+ bookmarks (SC-005). A single SQLite file
  gives durable storage, indexed search, and relational tag modeling with no
  external service. better-sqlite3 is synchronous and simple for a single-user app.
- **Alternatives considered**: A JSON file on disk (simple but risks corruption on
  concurrent writes and scales poorly for search/filter at 1k+ rows); an external
  database server (violates local-only assumption, adds ops burden).

## Decision: Front end — server-served static HTML + vanilla JavaScript

- **Rationale**: The UI is a handful of flows (save form, list with search/tag
  filter, edit, delete-confirm). Vanilla JS with `fetch` against the JSON API
  avoids a framework build pipeline and keeps the deliverable small and readable.
- **Alternatives considered**: React/Vue SPA (heavier tooling, unjustified for ~4
  flows); full server-side rendering per action (more round-trips, less responsive
  search).

## Decision: URL validation, normalization & title derivation

- **Rationale**: FR-002 requires a usable address; FR-003 requires an auto-derived
  title when none is given; edge cases require handling a missing scheme and an
  unreachable page. Approach: normalize with the WHATWG `URL` parser, assume
  `https://` when no scheme is present, reject values that cannot form a valid
  http(s) URL. For the title, attempt a short, time-bounded fetch of the page
  `<title>`; on any failure or timeout, fall back to the URL's host/path so saving
  always succeeds.
- **Alternatives considered**: Requiring the user to always type a scheme (worse
  UX, contradicts edge case); mandatory title entry (contradicts FR-003); no title
  fetch at all (weaker default titles). Title fetch is best-effort and never blocks
  saving, preserving local-only reliability.

## Decision: Duplicate handling — warn but allow

- **Rationale**: FR-012 and the approved v1 default. On save, the service checks
  for an existing bookmark with the same normalized address and returns a
  non-blocking duplicate warning alongside a successful save.
- **Alternatives considered**: Hard-reject duplicates (rejected by the client);
  silently allow (loses the warning the spec requires).

## Decision: Search & tag filtering — server-side query

- **Rationale**: SC-002/SC-005 require fast retrieval among many bookmarks.
  Keyword search matches title, address, and tags; tag filter selects bookmarks
  carrying a tag. Doing this in SQL with appropriate indexes keeps results within
  the 1-second target and avoids shipping the whole collection to the browser.
- **Alternatives considered**: Client-side filtering of a full download (simpler
  but degrades as the collection grows, risking SC-005).

## Decision: Testing — node:test + Playwright 1.61.0

- **Rationale**: Built-in `node:test` covers unit (URL/validation/title fallback)
  and API-level tests with no extra dependency. Playwright 1.61.0 (pinned to match
  the preinstalled browser binaries) covers the end-to-end browser flows named in
  the acceptance scenarios.
- **Alternatives considered**: Jest/Mocha (extra dependencies for no added value);
  skipping e2e (would leave acceptance scenarios unverified in a real browser).
