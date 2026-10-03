# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the approved spec and the runtime
environment described in project conventions. No open NEEDS CLARIFICATION remain.
Key decisions below.

## Decision: Runtime & server — Node.js 24 + Express

- **Decision**: Use Node.js 24 with Express to serve both the JSON API and the
  static frontend from one process, listening on `0.0.0.0:4000`, started via
  `npm start`.
- **Rationale**: Node.js 24 and npm are provided by the shared image. A single
  process satisfies the runtime presentation requirements (one port, one start
  command) and keeps the v1 footprint minimal. Express is a stable, well-known
  minimal HTTP framework.
- **Alternatives considered**: Bare `node:http` (more boilerplate for routing and
  static files); a framework like Next.js/Nest (heavier than a single-user CRUD
  app needs).

## Decision: Persistence — local SQLite via Node.js built-in `node:sqlite`

- **Decision**: Store bookmarks and tags in a local SQLite database file
  (`data/bookmarks.db`) using Node.js 24's built-in `node:sqlite` module
  (`DatabaseSync`).
- **Rationale**: The spec requires durable persistence across restarts (FR-005,
  SC-004) with local-only storage and no external services. SQLite is a
  file-based, zero-configuration store; `node:sqlite` is synchronous and simple,
  a good fit for a single-user app, and ships with the runtime (no third-party
  dependency). Relational tables cleanly model the many-to-many bookmark↔tag
  relationship for filtering (FR-012).
- **Update during implementation**: The plan first specified `better-sqlite3`.
  Its native addon crashed at process teardown (`RemoveEnvironmentCleanupHook`
  assertion) under the `node --test` runner in this environment, causing a flaky
  test suite. Switching to the built-in `node:sqlite` eliminated the crash
  (0 failures across repeated runs) and removed a dependency. Same SQLite storage,
  same schema; only the driver changed. `node:sqlite` has no `db.transaction()`
  helper, so transactions use explicit `BEGIN`/`COMMIT`/`ROLLBACK`.
- **Alternatives considered**: `better-sqlite3` (rejected — native teardown
  crash here); a JSON flat file (awkward for search/tag queries and concurrent
  writes); browser localStorage (would not survive across devices or provide
  server-side title fetch, and complicates the API contract); an external DB like
  PostgreSQL (violates local-only, adds a service dependency).

## Decision: Title derivation — server-side fetch with fallback

- **Decision**: On save, the server fetches the target address and extracts the
  page `<title>` (using node-html-parser); on any failure (unreachable page,
  timeout, no title) it falls back to using the address as the title.
- **Rationale**: FR-003 requires an auto-derived title with fallback to the
  address. Doing it server-side avoids browser cross-origin restrictions. A short
  timeout keeps saves fast (SC-001) and prevents a slow/unreachable page from
  blocking the save.
- **Alternatives considered**: Client-side fetch (blocked by CORS for arbitrary
  sites); no auto-title (fails FR-003); third-party metadata API (adds an external
  dependency, out of scope).

## Decision: Address validation & duplicate detection

- **Decision**: Validate that the submitted address is a well-formed `http`/`https`
  URL using the platform `URL` parser; reject empty/malformed input with a clear
  message (FR-001, FR-002). Detect duplicates by comparing normalized addresses
  (trimmed, lowercased scheme/host, without trailing slash) and warn without
  creating a second identical entry (FR-011).
- **Rationale**: Uses built-in parsing (no dependency); normalization prevents
  trivial duplicates (e.g., trailing slash / case differences) while staying
  predictable.
- **Alternatives considered**: Regex-only validation (brittle); exact string match
  for duplicates (misses trivial variants).

## Decision: Frontend — dependency-free HTML/CSS/vanilla JS

- **Decision**: A single static page in `public/` using vanilla JavaScript that
  calls the JSON API and renders the list, save/edit form, search box, tag
  filter, and empty/no-results states.
- **Rationale**: The UI is one screen with modest interactivity; a framework and
  build step add complexity without clear benefit at v1 scope. Serving static
  files keeps the single-process model and avoids a bundler.
- **Alternatives considered**: React/Vue with a build pipeline (unneeded weight
  and toolchain for one screen).

## Decision: Testing — node:test + Playwright 1.61.0

- **Decision**: Unit and API tests with Node's built-in `node:test`; end-to-end
  browser tests with Playwright pinned to 1.61.0 against Chromium.
- **Rationale**: `node:test` needs no extra dependency. The environment provides
  Playwright 1.61.0 and shared Chromium binaries; pinning to 1.61.0 matches the
  installed browser revision per project conventions.
- **Alternatives considered**: Jest/Mocha (extra dependencies for no added value);
  skipping E2E (would leave primary journeys unverified in a real browser).

## Decision: `data-harness-ready` marker

- **Decision**: The frontend sets `data-harness-ready="true"` on the main app
  element only after the initial bookmark list (including a valid empty state) has
  loaded.
- **Rationale**: Required by the runtime presentation environment to signal
  presentation readiness (not a loading/error placeholder).
