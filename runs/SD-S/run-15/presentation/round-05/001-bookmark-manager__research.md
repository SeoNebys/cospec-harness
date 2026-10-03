# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the approved spec and the
runtime environment; there were no open NEEDS CLARIFICATION markers. This file
records the key decisions and rationale.

## Decision: Runtime & language — Node.js 24 (ES modules)

- **Rationale**: The shared image provides Node.js 24 and expects the app to
  start via `npm start` on `0.0.0.0:4000`. Node lets one process serve both the
  API and the static UI with no build step.
- **Alternatives considered**: Python (Flask/FastAPI) — equally viable, but Node
  keeps a single language across server and browser and matches the `npm start`
  contract most directly.

## Decision: HTTP framework — Express 5

- **Rationale**: Minimal, well-understood routing for a small REST API plus
  static file serving. No heavy framework needed for a single-user tool.
- **Alternatives considered**: Node built-in `http` (more boilerplate for
  routing/JSON); Fastify (fine, but no advantage at this scale).

## Decision: Storage — SQLite via better-sqlite3

- **Rationale**: Local-only, single-user, must survive restarts (FR-003,
  SC-004). A single file database gives durable persistence, easy unique-address
  enforcement (a UNIQUE constraint), and fast keyword/tag queries over the
  low-thousands scale (SC-003). better-sqlite3 is synchronous, simplifying model
  code and tests.
- **Alternatives considered**: JSON file on disk (no query/index support, risk
  of partial writes / data loss); a client-server DB like PostgreSQL (external
  service, over-scaled for a single local user, disallowed by "local-only").

## Decision: Frontend — dependency-free vanilla SPA

- **Rationale**: Four simple views (main list, read-later, archive, add/edit)
  and desktop-first layout do not warrant a framework or bundler. No build step
  keeps `npm start` sufficient and lockfiles small.
- **Alternatives considered**: React/Vue (adds build tooling and dependencies
  for little gain at this scope).

## Decision: URL handling — normalize then validate

- **Rationale**: FR-002 and edge cases require accepting `example.com` by adding
  a scheme, rejecting non-web input, and treating the normalized address as the
  uniqueness key (FR-010). Use the platform `URL` parser; default missing scheme
  to `https://`; accept only `http`/`https`.
- **Alternatives considered**: Reject anything without a scheme (worse UX);
  accept arbitrary strings (breaks "open in new tab" and uniqueness).

## Decision: Title derivation — best-effort, non-blocking

- **Rationale**: FR-011 and assumptions state title fetching is best-effort and
  the app stays usable if it fails. Derive a fallback title from the address
  immediately; optionally attempt a lightweight fetch of the page `<title>` with
  a short timeout, falling back silently on any failure.
- **Alternatives considered**: Mandatory synchronous fetch (fragile, slow,
  breaks offline use); no derivation (leaves untitled bookmarks, violates
  FR-011).

## Decision: Testing — node --test + Playwright 1.61.0

- **Rationale**: Built-in test runner covers URL/model/API logic without extra
  deps. Playwright 1.61.0 (pinned to match the image's browser binaries) drives
  the core user journeys end-to-end in Chromium.
- **Alternatives considered**: Jest/Vitest (extra dependency); skipping E2E
  (would not validate the browser flows the spec centers on).
