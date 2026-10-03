# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the spec, its Assumptions, and
the project's runtime environment (Node.js 24, port 4000, `npm start`). No
`NEEDS CLARIFICATION` markers remained. Key decisions below.

## Decision: Runtime stack — Node.js 24 + Express

- **Decision**: Build a single Node.js web service using Express for HTTP
  routing, serving both the JSON REST API and the static frontend.
- **Rationale**: Node 24 and npm are provided by the shared image; `npm start`
  on `0.0.0.0:4000` is the prescribed launch mechanism. Express is a minimal,
  well-understood router that serves static files and JSON APIs from one
  process, satisfying "one port, one command" with the least moving parts.
- **Alternatives considered**: A separate frontend framework (React/Vite) build
  — rejected as unnecessary complexity for a small single-user UI and an extra
  build step. A serverless/edge approach — rejected; no external services are
  available or needed. Bare `http` module — rejected; Express reduces
  boilerplate for routing and static serving.

## Decision: Storage — local SQLite file via better-sqlite3

- **Decision**: Persist bookmarks and tags in a single SQLite database file at
  `data/bookmarks.db`, accessed with the synchronous `better-sqlite3` driver.
- **Rationale**: The spec requires durable local persistence for a single user
  (FR-004, SC-003) with no cloud sync. A file-based database gives real
  querying (search, tag filter) and transactional integrity without running a
  separate DB server. `better-sqlite3` is simple and fast for this scale.
- **Alternatives considered**: A flat JSON file — rejected; concurrent writes
  and querying/search become error-prone as the collection grows. PostgreSQL /
  MySQL — rejected; requires a separate server, over-scaled for one local user.
  Browser `localStorage` only — rejected; ties data to one browser profile and
  complicates search/backup.

## Decision: Data model for tags — many-to-many

- **Decision**: Model tags as their own entity with a join table linking
  bookmarks and tags (many-to-many).
- **Rationale**: The spec states a bookmark may have many tags and a tag may
  apply to many bookmarks (Key Entities). A join table makes tag filtering
  (FR-010) a straightforward query and avoids duplicating tag strings.
- **Alternatives considered**: Storing tags as a comma-separated string on the
  bookmark — rejected; makes exact-tag filtering and tag listing brittle.

## Decision: URL validation & normalization

- **Decision**: Validate that the input parses as an `http`/`https` URL; if the
  user omits the scheme (e.g. `example.com`), prepend `https://` before
  validating and storing.
- **Rationale**: Satisfies FR-003 (reject invalid, clear message) and the edge
  case for scheme-less input. Restricting to http/https keeps opened links safe
  and meaningful.
- **Alternatives considered**: Accepting any string — rejected; violates FR-003.
  Requiring the user to always type the scheme — rejected; poorer UX and
  contradicts the stated edge case.

## Decision: Duplicate handling — warn, do not block

- **Decision**: On save, detect an existing bookmark with the same normalized
  URL and return a non-blocking warning; the client surfaces it and lets the
  user confirm keeping the duplicate.
- **Rationale**: FR-011 requires warning while still allowing the save.
- **Alternatives considered**: Hard-blocking duplicates — rejected; contradicts
  FR-011.

## Decision: Testing approach

- **Decision**: Node built-in test runner for unit (URL helpers) and integration
  (API against a temporary SQLite db) tests; Playwright 1.61.0 for browser
  end-to-end validation of the user-story flows.
- **Rationale**: Built-in runner needs no extra dependency for API/unit tests.
  Playwright 1.61.0 matches the pinned browser binaries in the image, per the
  runtime rules, and validates the real UI scenarios in the spec.
- **Alternatives considered**: Jest/Mocha — rejected; extra dependency for no
  added value at this scale. A different Playwright version — rejected; would
  download a mismatched browser revision, which the runtime rules forbid.
