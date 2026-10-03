# Phase 0 Research: Bookmark Manager

All Technical Context items are resolved; no NEEDS CLARIFICATION remain. Key
decisions below.

## Decision 1: Backend needed for automatic metadata collection

- **Decision**: Include a small server-side endpoint that fetches the destination
  page and extracts its title, description, and icon.
- **Rationale**: FR-003 requires automatically collecting page title, description,
  and icon. A browser-only app cannot fetch arbitrary third-party pages because of
  cross-origin (CORS) restrictions, and cannot read their HTML `<head>`. A server
  making the request avoids this entirely. The server also satisfies the runtime
  requirement to serve on `0.0.0.0:4000`.
- **Alternatives considered**: (a) Pure client-side app + public CORS proxy —
  rejected: unreliable, third-party dependency, privacy leak of user's addresses.
  (b) Browser extension with host permissions — rejected: out of scope, heavier to
  install/review than a web app.

## Decision 2: Runtime + language = Node.js 24 + Express

- **Decision**: Node.js 24 with Express for HTTP + REST, static hosting for the
  frontend.
- **Rationale**: Node 24 is provided by the shared image and has a built-in
  `fetch`, avoiding an HTTP-client dependency. Express is minimal and well
  understood for a ~6-endpoint API plus static files, all in one process started
  by `npm start`.
- **Alternatives considered**: Bare `node:http` — rejected: more boilerplate for
  routing/static files. A full framework (Next.js/Nest) — rejected: build step and
  abstraction unwarranted at this scale.

## Decision 3: Storage = local SQLite via better-sqlite3

- **Decision**: Persist to a local SQLite file using better-sqlite3.
- **Rationale**: Satisfies local single-user persistence (FR-005, SC-002) with
  relational support for the many-to-many bookmark↔tag relationship and
  case-insensitive search. better-sqlite3 is synchronous, simple, and fast at this
  scale (hundreds–thousands of rows, SC-004).
- **Alternatives considered**: JSON file — rejected: awkward for tag joins,
  filtering, and concurrent-safe writes. A client-side store (localStorage/
  IndexedDB) — rejected: the backend already exists for metadata, and server-side
  storage keeps a single source of truth.

## Decision 4: Frontend = plain HTML/CSS/vanilla JS (no build step)

- **Decision**: Serve static HTML/CSS/JS that call the REST API.
- **Rationale**: The UI is small (list, add/edit form, search box, tag filter).
  Avoiding a framework and build toolchain keeps `npm start` sufficient and
  startup fast, matching the runtime environment guidance.
- **Alternatives considered**: React/Vue — rejected: build complexity not
  justified for this scope.

## Decision 5: Metadata extraction library

- **Decision**: Use node-html-parser to read `<title>`, `<meta name="description">`
  / Open Graph `og:description`, and icon (`<link rel="icon">` / `og:image`),
  falling back to the favicon path and then to an address-derived title.
- **Rationale**: Lightweight, no browser needed; handles messy real-world HTML.
  FR-004 requires saving to still succeed when extraction fails, so all fields are
  best-effort.
- **Alternatives considered**: Regex parsing — rejected: brittle. Headless
  Chromium — rejected: heavy and unnecessary for reading static `<head>` tags.

## Decision 6: Non-blocking save

- **Decision**: Persist the bookmark immediately on save; collect metadata and
  update the record, so the user is never blocked (SC-001, FR-004).
- **Rationale**: Metadata fetch latency varies with the remote site; the save must
  return quickly. The UI shows an address-derived title first and refreshes when
  metadata arrives.
- **Alternatives considered**: Synchronous fetch before responding — rejected:
  could exceed the 15s save budget and blocks on slow/dead sites.

## Decision 7: Address normalization for duplicate detection

- **Decision**: Normalize by lowercasing scheme+host and stripping a single
  trailing slash from the path before comparing (FR-015). Store the original
  address for display/opening; store a normalized key for uniqueness.
- **Rationale**: Meets FR-014/FR-015 so `Example.com/` and `example.com` are the
  same bookmark, and re-saving opens the existing entry (SC-006).
- **Alternatives considered**: Exact string match — rejected: fails the
  case/trailing-slash requirement.

## Decision 8: Testing approach

- **Decision**: `node --test` for API contract + unit tests (normalization,
  metadata parsing); Playwright 1.61.0 (pinned to match installed browsers) for a
  single end-to-end flow.
- **Rationale**: Fast feedback on logic without a browser; one E2E test proves the
  full save→organize→retrieve→edit→delete journey.
