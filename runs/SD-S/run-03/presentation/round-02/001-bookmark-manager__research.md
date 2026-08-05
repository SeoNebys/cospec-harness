# Phase 0 Research: Bookmark Manager

This document records the technical decisions that resolve the open choices in
the plan's Technical Context. The spec deliberately avoided technology; these are
the "how" decisions, made under the client's guidance to "keep it simple."

## Decision 1: Application shape — local web app (backend + static frontend)

- **Decision**: Build one small local web application: a Node.js backend that
  serves a static browser frontend and exposes a small JSON HTTP API.
- **Rationale**: FR-003 requires best-effort automatic title fetching. A pure
  browser-only app cannot fetch arbitrary third-party pages to read their
  `<title>` because of cross-origin (CORS) restrictions. A tiny backend performs
  the fetch server-side without that limitation, and also owns durable local
  storage (FR-005). Serving the frontend from the same process keeps it to a
  single command to launch.
- **Alternatives considered**:
  - *Pure client-side SPA with IndexedDB*: simplest to deploy, but cannot fetch
    page titles reliably and mixes persistence into the browser. Rejected.
  - *Browser extension*: great UX for capturing links, but larger surface, store
    review, and per-browser packaging — over budget for "keep it simple" v1.
  - *Native desktop app*: heavier tooling and per-OS packaging; unnecessary.

## Decision 2: Storage — embedded SQLite (single local file)

- **Decision**: Persist bookmarks and tags in a single local SQLite database file
  via `better-sqlite3`.
- **Rationale**: Meets FR-005 (survives restart) with zero external services.
  Gives real query/index support so search and tag filtering stay under 1 second
  at 1,000+ bookmarks (SC-002, SC-003). `better-sqlite3` is synchronous and
  simple to reason about for a single-user local app.
- **Alternatives considered**:
  - *Flat JSON file*: trivial to start, but full-file rewrite on every change and
    linear scans; awkward for search/tag queries at scale. Rejected.
  - *Client-side storage only*: ruled out with Decision 1.
  - *Server database (Postgres/MySQL)*: violates "no external services" and the
    simplicity steer for a single-user tool. Rejected.

## Decision 3: Frontend — plain HTML/CSS/vanilla JS (no framework)

- **Decision**: Hand-written HTML/CSS and vanilla JavaScript talking to the API.
- **Rationale**: The UI is a handful of views (list, add/edit form, search box,
  tag filter, empty state). A framework + build pipeline adds tooling cost with
  little benefit at this scale and would undercut the one-command launch goal.
- **Alternatives considered**: React/Vue/Svelte — reasonable if the UI grows, but
  premature now. Revisit if v2 adds richer interactions.

## Decision 4: Automatic title fetching — best-effort, server-side, bounded

- **Decision**: On save, if the user supplies no title, the backend fetches the
  page, parses the `<title>` element, and uses it. Apply a short timeout (~5s),
  follow a limited number of redirects, and cap the downloaded bytes. On any
  failure, fall back to a user-typed title or the address itself.
- **Rationale**: Satisfies FR-003 and the "unreachable page" edge case without
  letting a slow/huge page block the save. Bounding time and size protects the
  single local process.
- **Alternatives considered**: rich metadata (Open Graph, favicon, description)
  — nice-to-have, deferred to keep v1 small.

## Decision 5: URL validation and duplicate detection

- **Decision**: Accept only `http`/`https` URLs (per approved scope). Validate by
  parsing with the platform URL parser and rejecting anything that is not a
  well-formed http(s) URL (FR-002). Detect duplicates (FR-013) by comparing a
  normalised form of the URL (lowercased scheme+host, trailing-slash trimmed).
- **Rationale**: Normalisation avoids trivial duplicates (e.g. trailing slash or
  host case) while staying predictable. Warn-not-block matches the spec: the user
  may still choose to keep a near-duplicate.
- **Alternatives considered**: aggressive normalisation (stripping query params,
  tracking tokens) — risks treating genuinely different pages as duplicates.
  Rejected for v1; keep normalisation conservative.

## Decision 6: Testing approach

- **Decision**: Vitest as the test runner; Supertest to drive the HTTP API for
  integration tests that mirror the spec's acceptance scenarios; unit tests for
  model validation and the title fetcher (with network stubbed).
- **Rationale**: The API is the natural seam that ties requirements to verifiable
  behaviour. Stubbing the network keeps title-fetcher tests deterministic.
- **Alternatives considered**: Node's built-in `node:test` — fine, but Vitest
  gives nicer assertions/watch mode at negligible cost.

## Resolved unknowns

All Technical Context entries are now concrete; no `NEEDS CLARIFICATION` markers
remain.
