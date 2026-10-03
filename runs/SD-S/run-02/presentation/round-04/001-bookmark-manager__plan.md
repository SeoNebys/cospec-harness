# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application to save, organize, and revisit bookmarks. A user
saves a web address; the server best-effort fetches the page and enriches the
bookmark with title, description, favicon, and preview image. Bookmarks carry
user tags and a free-text note, can be edited/deleted, and are searchable across
title, address, description, tags, and note (plus tag filtering). Saving an
already-bookmarked address routes the user to edit the existing entry rather than
rejecting the save. Data persists locally on the server so it survives restarts.

Technical approach: a small Node.js web service (Express) exposing a JSON REST
API and serving a static single-page frontend. Persistence via a local SQLite
database file (`better-sqlite3`). Enrichment is performed server-side (to avoid
browser cross-origin restrictions) by fetching the target page and parsing
Open Graph / standard HTML metadata, always best-effort and non-blocking to the
save itself.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express 5 (HTTP server + REST API), better-sqlite3
(embedded persistence), node-html-parser (lightweight metadata extraction).
Frontend is dependency-free (vanilla HTML/CSS/JS served statically). Playwright
1.61.0 (dev-only) for end-to-end validation.

**Storage**: Local SQLite database file at `data/bookmarks.db` (single-user,
on-disk, survives restart). WAL mode for reliability.

**Testing**: Node built-in test runner (`node --test`) for unit/API tests;
Playwright 1.61.0 for a small end-to-end smoke of the primary user journeys.

**Target Platform**: Modern desktop web browser (Chromium-tested); server runs
on Node.js 24 in the shared Linux image.

**Project Type**: Web application (backend service + static frontend), single
deployable process.

**Performance Goals**: List renders and is usable within 2s for up to 500
bookmarks (SC-005); search across 100+ bookmarks feels instant (<200ms server
response). Enrichment runs asynchronously and never blocks the save response.

**Constraints**: Server MUST listen on `0.0.0.0:4000` and be started by
`npm start` (runtime presentation env). Saving MUST succeed even when enrichment
fails (FR-008). Enrichment fetch is time-bounded (e.g. ~5s timeout, capped
response size) so a slow/large page never hangs a save. No third-party
enrichment service.

**Scale/Scope**: Single user; hundreds to low thousands of bookmarks; ~5 primary
screens/flows (list, add, detail/edit, search/filter, empty state).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template — it contains only placeholder principles and no ratified rules. There
are therefore no concrete constitutional gates to enforce for this feature.

Applied general SDD hygiene in lieu of ratified principles:

- **Spec-first**: Implementation is derived from the approved spec; no work
  beyond spec scope (folders/multi-user/cloud sync remain out of scope).
- **Simplicity / YAGNI**: Single process, one embedded datastore, no framework on
  the frontend. No speculative abstractions.
- **Testable**: Each functional requirement maps to an API contract and/or a
  validation scenario in quickstart.md.

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── rest-api.md      # REST API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # Express app entry; binds 0.0.0.0:4000; serves API + static
├── db.js                # SQLite connection + schema init/migration
├── repository.js        # Data access: CRUD, search, tag queries
├── enrichment.js        # Best-effort page fetch + metadata parse (title/desc/favicon/preview)
├── validation.js        # URL validation + normalization (http/https)
└── routes/
    └── bookmarks.js     # REST handlers for /api/bookmarks and /api/tags

public/                  # Static frontend (dependency-free)
├── index.html           # App shell; sets data-harness-ready after initial load
├── app.js               # UI logic: list, add, edit, delete, search, tag filter
└── styles.css           # Desktop-first styling, responsive-safe

tests/
├── unit/                # validation, enrichment parsing (node --test)
├── api/                 # REST endpoint behavior against a temp DB (node --test)
└── e2e/                 # Playwright smoke of primary journeys

data/                    # SQLite database file (gitignored); created at runtime
package.json             # "start": "node src/server.js"; deps + pinned playwright
```

**Structure Decision**: Single deployable web application. Backend and frontend
live in one process/repo (`src/` + `public/`) because this is a single-user app
with a modest API surface; a split frontend/backend build would add ceremony
without benefit. `npm start` runs `src/server.js`, satisfying the runtime
presentation contract (port 4000, bound to `0.0.0.0`).

## Complexity Tracking

> No constitution violations. Section intentionally empty.
