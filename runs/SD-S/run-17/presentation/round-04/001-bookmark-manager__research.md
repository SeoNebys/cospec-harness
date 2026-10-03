# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the approved spec, its assumptions,
and the runtime environment described in project conventions. No open
NEEDS CLARIFICATION items remain. Key decisions below.

## Decision 1: Runtime & web framework — Node.js 24 + Express

- **Decision**: Build the app as a Node.js 24 service using Express to serve both the
  JSON API and the static browser UI.
- **Rationale**: The review runtime provides Node.js 24 and starts the app via
  `npm start` on port 4000 bound to `0.0.0.0`. A single Express process serving API
  + static assets is the simplest thing that satisfies this exactly. Express is
  minimal, well understood, and needs no build step.
- **Alternatives considered**: A framework like Next.js/Nuxt (rejected: adds a build
  pipeline and complexity beyond a single-user CRUD app); a pure static SPA with no
  server (rejected: title-fetch on save and local shared persistence need a server;
  browser-only fetch is blocked by CORS for arbitrary pages).

## Decision 2: Persistence — SQLite via better-sqlite3

- **Decision**: Store bookmarks and tags in a local SQLite file (`data/bookmarks.db`)
  accessed with better-sqlite3.
- **Rationale**: Approved assumption is "local persistence is sufficient" (no sync,
  no cloud). SQLite is a single file, needs no external service, survives restarts
  (SC-003), and comfortably handles hundreds–thousands of rows with fast search
  (SC-002). better-sqlite3 is synchronous and simple, ideal for single-user scale.
- **Alternatives considered**: A JSON flat file (rejected: no indexed search, risk of
  corruption on concurrent writes, awkward tag queries); Postgres/MySQL (rejected:
  external service, over-engineered for one user); browser localStorage (rejected:
  data trapped per-browser, no server-side title fetch, weak for 200+ items).

## Decision 3: Front end — plain HTML/CSS/vanilla JS, no bundler

- **Decision**: A single `index.html` plus `app.js` and `styles.css`, talking to the
  JSON API with `fetch`.
- **Rationale**: The UI is modest (~4 views). Avoiding a framework/bundler removes a
  build step, keeps startup to `npm start`, and keeps the whole thing reviewable.
- **Alternatives considered**: React/Vue + Vite (rejected: build tooling and bundle
  size unjustified for this scope); server-side templating (rejected: a small JSON
  API + client rendering keeps search/filter snappy without full page reloads).

## Decision 4: Best-effort title fetch

- **Decision**: On save, if the user gave no title, the server fetches the page with a
  short timeout (~5s), parses the `<title>` from the HTML, and uses it; on any
  failure it falls back to the user title or the address itself. Failure never blocks
  the save.
- **Rationale**: Directly implements FR-004 and the "unreachable page on save" edge
  case. A short timeout keeps saves fast (SC-001) even when a page is slow/unreachable.
- **Alternatives considered**: Third-party metadata/OpenGraph services (rejected:
  external dependency, privacy, and the spec only requires a title); client-side fetch
  (rejected: CORS blocks reading arbitrary cross-origin pages in the browser).

## Decision 5: Address validation & normalisation

- **Decision**: Validate that the input parses as an http/https URL; if no scheme is
  present, prepend `https://` before validating (FR-002, FR-003). Reject anything that
  still fails to parse.
- **Rationale**: Implements the "address without a scheme" edge case and keeps
  invalid entries out (SC-005) while accepting common shorthand like `example.com`.
- **Alternatives considered**: Accept any non-empty string (rejected: violates FR-002);
  strict regex (rejected: brittle; the platform URL parser is more reliable).

## Decision 6: Duplicate detection

- **Decision**: Compare a normalised form of the address (scheme+host+path, lowercased
  host, trailing-slash tolerant) against existing bookmarks; on a match, warn the user
  and do not create a silent duplicate (FR-010).
- **Rationale**: Implements the duplicate edge case without blocking intentional
  re-saves — the warning lets the user decide.
- **Alternatives considered**: Exact string match only (rejected: `example.com/` vs
  `example.com` would slip through); hard block on duplicates (rejected: spec says
  "warn", not "forbid").

## Decision 7: Testing approach

- **Decision**: `node --test` for unit tests (URL normalisation, dedupe, title
  fallback) and API tests; Playwright 1.61.0 for end-to-end journeys.
- **Rationale**: Built-in test runner needs no extra deps. Playwright is provided by
  the image and must be pinned to 1.61.0 so its browser revision matches the shared
  binaries (per project conventions).
- **Alternatives considered**: Jest/Mocha (rejected: extra dependency vs the built-in
  runner for this scope).
