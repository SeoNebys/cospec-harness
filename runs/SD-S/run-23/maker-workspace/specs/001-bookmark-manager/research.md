# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the spec, the harness
constraints (Node 24, Playwright 1.61.0, serve on `0.0.0.0:4000`), and common
practice. No open `NEEDS CLARIFICATION` items remain. Key decisions below.

## Decision 1: Runtime & web framework — Node.js 24 + Express

- **Decision**: Node.js 24 with Express serving both the JSON API and the static
  frontend from one origin.
- **Rationale**: Node 24 is provided by the shared image and includes a global
  `fetch`, which we need for server-side metadata collection. Express is minimal,
  well understood, and serves static assets without a build step. Same-origin
  hosting sidesteps CORS entirely.
- **Alternatives considered**: Bare `node:http` (more boilerplate for routing);
  Fastify (fine, but no advantage here); a SPA framework like React (adds a build
  toolchain and browser-download revisions for no real benefit at this scope).

## Decision 2: Storage — SQLite via the built-in `node:sqlite` module

- **Decision**: Persist bookmarks and tags in a local SQLite file using Node 24's
  built-in `node:sqlite` (`DatabaseSync`).
- **Rationale**: Requirement FR-012 needs durable persistence across restarts.
  SQLite is a single file, needs no external service (the harness does not
  prescribe a database), supports the relational many-to-many tag model cleanly,
  and enforces the unique-address constraint (FR-019) at the storage layer. Its
  synchronous API suits a single-user app. Using the built-in module avoids a
  native addon dependency entirely.
- **Note**: The initial choice was the `better-sqlite3` addon, but on this Node
  runtime its native `Statement` finalizers abort during process teardown
  ("Assertion failed: (env) != nullptr") — harmless to the long-lived server but
  it made the automated test suite flaky. `node:sqlite` offers the same
  synchronous prepare/get/all/run API without a native addon, so it was adopted
  instead. `node:sqlite` has no `db.transaction()` helper, so transactions are
  wrapped manually with `BEGIN`/`COMMIT`/`ROLLBACK`.
- **Alternatives considered**: `better-sqlite3` (native teardown crash above);
  a JSON file (no atomicity, awkward querying/joins, race-prone); Postgres/MySQL
  (external service, overkill for one user); in-memory only (fails persistence).

## Decision 3: Metadata collection — server-side fetch + HTML parsing

- **Decision**: On save, the server fetches the target URL and parses metadata
  from the returned HTML: title from Open Graph `og:title` then `<title>`;
  description from `og:description` then `<meta name="description">`; favicon from
  `<link rel="icon">`/`apple-touch-icon` (resolved to an absolute URL) with a
  fallback to `/favicon.ico` at the site root. Uses `node-html-parser`.
- **Rationale**: Fetching server-side avoids browser CORS restrictions that would
  block reading arbitrary third-party pages from the client. Open Graph tags are
  the de-facto standard for shareable page details and cover the required title,
  description, and favicon (FR-004).
- **Timeout & failure handling**: The fetch uses an `AbortController` timeout
  (~4s) so collection never blocks the save (FR-007, SC-006). On timeout, network
  error, non-HTML content, or missing tags, the affected fields fall back to the
  address/host and a placeholder favicon; the bookmark still saves.
- **Alternatives considered**: Headless-browser rendering via Playwright (heavier,
  slower, unnecessary for pages that expose static meta tags); client-side fetch
  (blocked by CORS); a third-party metadata API (external dependency, not
  guaranteed available in this environment).

## Decision 4: Duplicate handling — unique address, navigate to existing

- **Decision**: Normalize the address (apply `https://` when scheme omitted, per
  FR-003) and enforce uniqueness on it. When a save targets an existing address,
  the API returns the existing bookmark with an indicator that it already existed;
  the UI navigates/scrolls to and highlights that bookmark instead of adding a
  row (FR-019).
- **Rationale**: Directly satisfies the client's requested behavior and prevents
  clutter. Enforcing uniqueness in the database guarantees correctness even under
  rapid repeated saves.
- **Alternatives considered**: Allowing duplicates with a warning (explicitly
  rejected by the client); silent no-op (loses the "take me to the existing one"
  affordance the client asked for).

## Decision 5: Tag model — normalized many-to-many, case-insensitive

- **Decision**: Store tags in their own table (name stored trimmed; a normalized
  lowercase key enforces uniqueness) with a join table linking bookmarks to tags.
  Tag suggestions come from the set of existing tag names; filtering by a tag
  queries the join table (FR-014–FR-016).
- **Rationale**: A normalized model makes "choose from existing tags", filtering,
  and case-insensitive de-duplication (FR-015) straightforward and consistent.
- **Alternatives considered**: Storing tags as a comma-separated string on the
  bookmark (hard to enumerate distinct tags, filter reliably, or dedupe casing).

## Decision 6: Testing — node:test + pinned Playwright

- **Decision**: Unit and integration tests with Node's built-in `node:test`;
  one Playwright 1.61.0 end-to-end smoke test covering save → list → tag/filter →
  edit → delete.
- **Rationale**: `node:test` needs no extra dependency. Playwright is pre-installed
  with matching browser binaries; pinning to 1.61.0 keeps the browser revision in
  sync per harness guidance. Metadata parsing is tested against fixture HTML (no
  network) so tests are deterministic.
- **Alternatives considered**: Jest/Mocha (extra dependencies for no gain);
  skipping e2e (would leave the primary user journeys unverified end-to-end).
