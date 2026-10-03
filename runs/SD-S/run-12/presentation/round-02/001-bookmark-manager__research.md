# Phase 0 Research: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-18

This document resolves the open technical choices for the plan. The spec constrains
us to a single-user, locally-stored, desktop web application that must be served in
the review environment on `0.0.0.0:4000` via a foreground `npm start`.

## Decision 1: Application shape — server + browser client

- **Decision**: A small Node.js HTTP server (Express) that serves a static
  single-page browser client and exposes a minimal REST API for bookmark CRUD.
- **Rationale**: The runtime contract requires a server listening on port 4000 that
  survives the model call and is started by `npm start`. A server-backed API lets us
  persist data on the server (durable across browser sessions and different review
  clients), directly satisfying FR-009 and SC-004. It also keeps the client simple.
- **Alternatives considered**:
  - *Pure static SPA with browser `localStorage`*: simplest to serve, but data lives
    only in one browser profile. A different review client or a cleared profile loses
    data, weakening the "no data loss across restarts" guarantee. Rejected.
  - *Desktop-native (Electron/Tauri)*: heavier, cannot be reviewed through the shared
    HTTP capture on port 4000. Rejected as out of scope.

## Decision 2: Language / runtime

- **Decision**: JavaScript on Node.js 24 (the image-provided runtime), no build step,
  ES modules.
- **Rationale**: Node 24 and npm are provided by the image. Avoiding a bundler/build
  step keeps `npm start` a single foreground command and keeps the codebase small and
  reviewable. Plain modern browser JS is sufficient for the UI scope.
- **Alternatives considered**:
  - *TypeScript + bundler (Vite/webpack)*: adds a build step before `npm start` and
    more dependencies for a small app. Deferred; not needed for v1.

## Decision 3: Persistence

- **Decision**: SQLite via `better-sqlite3`, storing a single database file under a
  local `data/` directory.
- **Rationale**: File-backed SQLite gives durable local persistence with no external
  service, satisfying FR-009 and SC-004. `better-sqlite3` is synchronous and simple,
  a good fit for a low-concurrency single-user app. Tags and search map cleanly to SQL.
- **Alternatives considered**:
  - *JSON file on disk*: workable but hand-rolled concurrency/queries and easy to
    corrupt on partial writes. Rejected in favor of SQLite's durability.
  - *In-memory only*: violates persistence requirement. Rejected.

## Decision 4: HTTP framework

- **Decision**: Express 4.
- **Rationale**: Minimal, ubiquitous, well understood; enough to serve static files
  and a handful of JSON routes. Keeps the server file short.
- **Alternatives considered**: Node's built-in `http` (more boilerplate for routing);
  Fastify (fine, but no advantage at this scale). Both rejected for simplicity.

## Decision 5: URL validation and normalization

- **Decision**: Use the WHATWG `URL` API (built into Node and browsers). Reject
  addresses that do not parse; when no scheme is present, prepend `https://` before
  parsing (FR-002, FR-003). Only accept `http:`/`https:` schemes.
- **Rationale**: Standard, dependency-free, consistent between client and server. The
  server re-validates so the API cannot be bypassed.
- **Alternatives considered**: Regex validation (brittle, error-prone). Rejected.

## Decision 6: Testing approach

- **Decision**: Node's built-in `node:test` runner for unit/API tests (URL
  normalization, CRUD, search/filter, duplicate detection), plus Playwright `1.61.0`
  for one end-to-end browser flow (save → list → open → edit → delete).
- **Rationale**: `node:test` needs no extra dependency. Playwright is provided by the
  image at 1.61.0 with shared browser binaries; pinning to that version avoids a second
  browser download (per the runtime notes).
- **Alternatives considered**: Jest/Vitest (extra deps, not needed). Rejected.

## Decision 7: Search and tag filtering

- **Decision**: Server-side filtering via SQL `LIKE` on title/address/notes and a join
  on tags; case-insensitive keyword match (FR-010, FR-011). Default ordering by
  `date_added` descending (FR-014).
- **Rationale**: At the expected scale (hundreds of bookmarks, SC-003) simple SQL is
  instant and keeps the client thin. Avoids premature full-text indexing.
- **Alternatives considered**: SQLite FTS5 (overkill for hundreds of rows);
  client-side filtering (would require shipping all rows and duplicating logic).
  Both deferred.

## Runtime delivery notes (carried into implementation)

- Server binds `0.0.0.0:4000`; `npm start` runs it in the foreground.
- `/work/.harness/app.json` will declare `kind: application`, port 4000, path `/`,
  start command `["npm","start"]`, cwd `/work`.
- The root UI sets `data-harness-ready="true"` only after the initial bookmark list
  (or empty state) has loaded.
- No login is required (single-user), so no review credentials are needed.

All NEEDS CLARIFICATION items are resolved; no open questions remain for planning.
