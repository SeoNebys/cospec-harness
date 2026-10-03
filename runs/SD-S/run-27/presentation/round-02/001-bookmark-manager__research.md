# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the approved spec and the runtime
environment described in project conventions; there were no open NEEDS CLARIFICATION
items. Key decisions are recorded below.

## Decision: Runtime & web framework — Node.js 24 + Express

- **Rationale**: Node.js 24 is provided by the shared image. Express is a mature,
  minimal HTTP/routing library that can serve both a JSON API and static files from
  one process, satisfying the same-origin and port-4000 review requirements with
  little ceremony.
- **Alternatives considered**: Bare `http` module (more boilerplate for routing/
  static serving); Fastify (fine, but no advantage at this scale); a full-stack
  framework like Next.js (over-engineered for a single-user CRUD app).

## Decision: Storage — SQLite via better-sqlite3

- **Rationale**: The spec requires durable persistence across restarts (FR-004,
  SC-003) with search and tag filtering over up to ~1,000 items (SC-005). A single
  SQLite file gives real querying, indexing, and transactional integrity with no
  external service to run. better-sqlite3 is synchronous and simple, ideal for a
  single-user local app.
- **Alternatives considered**: Flat JSON file (loses indexed search, risk of
  corruption on concurrent writes); PostgreSQL/MySQL (needs a separate service,
  contradicts YAGNI for a single local user); in-memory only (fails persistence).

## Decision: Front end — plain HTML/CSS/vanilla JS

- **Rationale**: Four simple views and CRUD interactions do not warrant a framework.
  Vanilla JS with `fetch` keeps dependencies and build steps to zero and loads fast.
- **Alternatives considered**: React/Vue (build tooling and bundle overhead not
  justified at this scope). Can be revisited if the UI grows.

## Decision: Tags stored in a normalized join structure

- **Rationale**: Tag filtering (FR-007) and "tags with no remaining bookmarks
  disappear" (edge case) are cleanest with a `tags` table and a `bookmark_tags`
  join table. Enables efficient filtering and accurate available-tag listing.
- **Alternatives considered**: Comma-separated tag string on the bookmark row
  (simpler to write, but makes filtering and tag enumeration error-prone).

## Decision: Address validation via the WHATWG URL parser

- **Rationale**: FR-002 requires rejecting invalid addresses. Node's built-in `URL`
  constructor provides standards-based parsing with no dependency. Inputs missing a
  scheme are normalized by attempting an `https://` prefix before rejecting.
- **Alternatives considered**: Regex validation (brittle, well-known to miss cases);
  third-party validator library (unnecessary given the built-in).

## Decision: Duplicate handling — warn, do not block

- **Rationale**: FR-011 requires warning on an existing address without preventing
  the save. The API returns a non-blocking `duplicateOf` hint; the client surfaces
  a warning and lets the user confirm.
- **Alternatives considered**: Hard-block duplicates (contradicts FR-011); silently
  allow (fails the warning requirement).

## Decision: Testing — node --test + Playwright 1.61.0

- **Rationale**: Built-in test runner covers validation, repository, and API layers
  with no extra framework. Playwright (pinned to 1.61.0 to match the shared browser
  binaries) verifies the primary save→browse→open flow end to end.
- **Alternatives considered**: Jest/Mocha (extra dependency; built-in runner
  suffices). Unpinned Playwright (would risk a browser-revision mismatch).
