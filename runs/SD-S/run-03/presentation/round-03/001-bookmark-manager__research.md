# Phase 0 Research: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16

This document resolves the technical unknowns for the plan. The runtime
environment (Node.js 24, npm, `npm start`, HTTP server on `0.0.0.0:4000`,
Playwright 1.61.0) constrains several choices; decisions favour a small, robust,
dependency-light stack that runs with no external services.

## Decision 1: Application architecture

- **Decision**: A single Node.js web application — an Express HTTP server that
  exposes a small JSON REST API and also serves a static single-page frontend
  (vanilla HTML/CSS/JS) from the same origin and port (4000).
- **Rationale**: Same-origin removes CORS/session complexity. One process is
  simplest to start via `npm start`. Vanilla frontend avoids a build step and
  keeps the whole app inspectable, matching the "small single-user app" scope.
- **Alternatives considered**:
  - *React/Vite SPA + separate API*: heavier tooling and a build step for a
    modest UI; rejected for v1 as unnecessary complexity.
  - *Server-rendered templates (EJS/Handlebars)*: viable, but a JSON API + thin
    client keeps client-side search/filter responsive and testable.

## Decision 2: Persistence

- **Decision**: SQLite via `better-sqlite3`, stored as a file under `data/`.
- **Rationale**: Bookmarks must survive reloads and restarts (FR-004, SC-002).
  SQLite is a single file, needs no external service (the environment prescribes
  none), gives real relational queries for tag filtering and keyword search, and
  `better-sqlite3` offers a simple synchronous API well-suited to a small app.
- **Alternatives considered**:
  - *JSON file on disk*: simplest, but concurrent-write safety and querying get
    awkward as tags/search grow; rejected.
  - *PostgreSQL/MySQL*: needs an external server the environment does not
    provide; over-scaled for a single user; rejected.

## Decision 3: Web address validation

- **Decision**: Validate with the WHATWG `URL` constructor (built into Node and
  browsers); accept only `http:` and `https:` schemes; normalize before storing
  and before duplicate checks.
- **Rationale**: Satisfies FR-002 (reject malformed) and the v1 scope assumption
  (web pages only). Normalization (lowercase host, strip default ports, drop
  trailing slash on empty path) makes duplicate detection (FR-009) reliable.
- **Alternatives considered**:
  - *Regex validation*: brittle and error-prone; rejected in favour of the
    standard URL parser.

## Decision 4: Best-effort page-title fetching

- **Decision**: On save, the server fetches the target page (global `fetch` in
  Node 24) with a short timeout (~5s) and size cap, and extracts the `<title>`.
  On any failure (timeout, non-HTML, network error, no title) it falls back to
  the submitted address. Title fetch never blocks or fails the save.
- **Rationale**: Satisfies FR-003 and the "best-effort" assumption plus the
  unreachable-page edge case. A timeout and size cap keep saves fast (SC-001).
- **Alternatives considered**:
  - *Headless-browser title extraction*: unnecessary weight; a simple HTML fetch
    + `<title>` parse covers the common case.
  - *Client-side fetch*: blocked by CORS for most sites; must run server-side.

## Decision 5: Search and tag filtering

- **Decision**: Server-side query. Keyword search matches (case-insensitive,
  substring) against title, address, and tag names; tag filter narrows to
  bookmarks carrying the selected tag(s). Results ordered most-recently-saved
  first by default (FR-014).
- **Rationale**: Keeps a single source of truth and scales past what a client
  holds in memory; meets SC-003 (find one of 100 quickly) comfortably.
- **Alternatives considered**:
  - *Client-only filtering*: fine at small scale but duplicates logic and ships
    all rows to the client; server-side chosen for a clean contract.
  - *SQLite FTS5 full-text index*: more power than needed at v1 scale; plain
    `LIKE` matching is sufficient and simpler. Revisit if collections grow large.

## Decision 6: Testing approach

- **Decision**: `node:test` (built-in) for unit tests of validation, URL
  normalization, and title extraction; Playwright 1.61.0 (pinned in devDeps to
  match the installed browsers) for end-to-end UI/API flows against the running
  server.
- **Rationale**: Meets the environment's Playwright pinning requirement and
  keeps unit testing dependency-free. E2E covers the acceptance scenarios.
- **Alternatives considered**:
  - *Jest/Vitest*: capable, but `node:test` avoids extra dependencies for the
    unit layer.

## Decision 7: Runtime presentation wiring

- **Decision**: Server listens on `0.0.0.0:4000`; `npm start` runs it in the
  foreground; `/work/.harness/app.json` declares `kind: application`, port 4000,
  path `/`, start command `["npm","start"]`. The root UI sets
  `data-harness-ready="true"` once the initial bookmark list (or empty state)
  has loaded. HTTP-session cookies (if used) are configured to work over plain
  HTTP in the review environment.
- **Rationale**: Directly follows the project's runtime presentation
  requirements so the client can review the running app.

## Summary of resolved unknowns

| Unknown | Resolution |
|---|---|
| Language/runtime | Node.js 24 (JavaScript, ES modules) |
| Web framework | Express |
| Persistence | SQLite via better-sqlite3 (file under `data/`) |
| Frontend | Vanilla HTML/CSS/JS, static, same origin |
| URL validation | WHATWG `URL`, http/https only, normalized |
| Title fetching | Server-side `fetch`, timeout + size cap, best-effort |
| Search/filter | Server-side substring match + tag filter |
| Testing | `node:test` (unit) + Playwright 1.61.0 (e2e) |
