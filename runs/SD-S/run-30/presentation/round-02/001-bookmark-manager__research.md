# Phase 0 Research: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-27

The spec is a single-user, no-login web app for saving and managing bookmarks.
The runtime environment (see project CLAUDE.md) provides Node.js 24, npm, a
C/C++ toolchain, and Playwright 1.61.0, and requires a web server listening on
`0.0.0.0:4000` started via a foreground command. The decisions below pick the
simplest stack that satisfies the spec and fits that environment.

## Decision 1: Runtime & server framework

- **Decision**: Node.js 24 (ES modules) with Express 4 serving both a small JSON
  REST API and the static frontend.
- **Rationale**: Node 24 and npm are provided; `npm start` matches the harness's
  expected `start_command`. Express is minimal, stable, and well understood for a
  small API plus static file serving from one process on one port.
- **Alternatives considered**: Python + Flask (also available, but the harness
  example and lockfile guidance lean Node); a full framework (Next.js/Nest) —
  rejected as far more than a single-user CRUD app needs.

## Decision 2: Storage

- **Decision**: SQLite in a single file (`data/bookmarks.db`) accessed with
  `better-sqlite3`.
- **Rationale**: Meets FR-012 durable persistence across restarts with no
  external database service. `better-sqlite3` is synchronous and simple, giving
  transactional writes (no data loss mid-write) and fast queries well within the
  performance targets (SC-002/SC-003) for the ~1,000-bookmark scale. The native
  build is supported by the provided C/C++ toolchain.
- **Alternatives considered**: Flat JSON file — simplest but risks corruption on
  crash mid-write and weaker querying; a client/server DB (Postgres) — rejected,
  needs an external service not guaranteed in the review environment; Node's
  experimental `node:sqlite` — rejected for now to avoid depending on an
  experimental API.

## Decision 3: Data shape for tags

- **Decision**: Normalized tables — `bookmarks`, `tags`, and a `bookmark_tags`
  join table.
- **Rationale**: Cleanly supports FR-005 (many tags per bookmark) and FR-008
  (filter by a tag) and listing distinct tags for the filter UI, without
  string-parsing hacks.
- **Alternatives considered**: A comma-separated / JSON tags column — simpler to
  write but makes tag filtering and a distinct-tag list awkward and error-prone.

## Decision 4: Frontend

- **Decision**: A single static page (HTML + CSS + vanilla JavaScript) served by
  Express, calling the JSON API with `fetch`.
- **Rationale**: The UI is a list, a form, search, and tag filter — no framework
  needed. Keeps dependencies and the lockfile minimal (per environment guidance)
  and startup trivial. The page sets `data-harness-ready="true"` once the initial
  bookmark list (or empty state) has loaded, as the harness requires.
- **Alternatives considered**: React/Vue SPA — rejected as unnecessary weight and
  build complexity for this scope.

## Decision 5: URL validation & duplicate detection

- **Decision**: Validate with the WHATWG `URL` parser, accepting only `http`/
  `https`. Detect duplicates (FR-013) by comparing a normalized form of the URL
  (trimmed, lowercased scheme and host, default ports and a single trailing slash
  removed).
- **Rationale**: Satisfies FR-002 (reject malformed addresses with a clear
  message) and FR-013 (warn on an already-saved address) using the platform's
  standard parser rather than fragile custom regex.
- **Alternatives considered**: Regex URL validation — rejected as error-prone;
  exact-string dedupe — rejected because trivial variants (trailing slash, case
  in host) would slip through as silent duplicates.

## Decision 6: Best-effort title fetching

- **Decision**: On save, if no title is supplied, fetch the page with the global
  `fetch` API (short timeout) and extract the `<title>`; on any failure fall back
  to the URL as the label. Title fetching never blocks or fails the save.
- **Rationale**: Satisfies FR-003 and the "unreachable page" edge case — saves
  always succeed, with the URL as a fallback label.
- **Alternatives considered**: A full HTML parser (e.g., cheerio) — a lightweight
  targeted `<title>` extraction is enough and avoids an extra dependency; blocking
  the save until the title resolves — rejected, harms responsiveness and fails on
  unreachable pages.

## Decision 7: Testing

- **Decision**: Node's built-in `node:test` runner for API/integration tests
  against the storage and routes; Playwright `1.61.0` for one end-to-end smoke
  test of the save → list → search flow.
- **Rationale**: `node:test` needs no extra dependency; Playwright is pinned to
  `1.61.0` to match the preinstalled browser binaries per environment guidance.
- **Alternatives considered**: Jest/Vitest — extra dependencies for no benefit at
  this scale.

## Resolved unknowns

All Technical Context items are resolved; no `NEEDS CLARIFICATION` remain. The
access-model question (single-user, no login) was resolved in the spec (FR-015).
