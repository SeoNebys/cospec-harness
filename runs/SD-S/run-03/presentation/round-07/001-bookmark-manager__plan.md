# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, local bookmark manager for web links. The user saves links (with
best-effort automatic title fetching), then browses, searches, tags, annotates,
edits, and deletes them. Everything is stored locally and persists across
sessions; there is no sign-in, no cloud sync, and no multi-user support in v1.

**Technical approach**: A small self-contained local web application — a
lightweight backend that owns persistence and fetches page titles server-side
(avoiding browser cross-origin limits), plus a plain browser frontend for the
list/search/tag UI. One process, one local database file, launched with a single
command.

## Technical Context

**Language/Version**: JavaScript on Node.js 20 LTS (runtime for both the local server and tests).

**Primary Dependencies**: Express (HTTP + static file serving), better-sqlite3 (embedded local database). Page `<title>` extraction uses a small built-in parser (no extra dependency; confirmed with the client). Frontend is plain HTML/CSS/vanilla JavaScript — no UI framework.

**Storage**: A single local SQLite database file (e.g. `data/bookmarks.db`). No external database server.

**Testing**: Vitest for unit and integration tests; Supertest to exercise the HTTP API end-to-end.

**Target Platform**: Runs locally on the user's machine (macOS/Linux/Windows with Node installed); UI viewed in a modern desktop browser.

**Project Type**: Local web application (backend API + static browser frontend) in a single project.

**Performance Goals**: Search/filter results reflected within 1 second for 1,000 bookmarks (SC-003); list and search feel instant for a personal-scale collection.

**Constraints**: Offline-capable for all core operations (list, search, tag, edit, delete, and saving with a user-supplied title); only automatic title fetching requires network access and degrades gracefully when offline.

**Scale/Scope**: One user; designed to stay responsive to at least several thousand bookmarks. Roughly 5 screens/views (list, add, edit, tag-filter, empty state).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no explicit governance gates
to enforce. The plan nonetheless adheres to the spirit of common SDD principles:

- **Simplicity / YAGNI**: single project, single process, single local DB file, no
  framework on the frontend; multi-user, sync, and import are explicitly deferred.
- **Testability**: the API is the seam under test (Vitest + Supertest); data rules
  live in the model layer and are unit-testable.
- **Spec-derived**: every functional requirement maps to a contract endpoint and a
  data-model rule (see Phase 1 artifacts).

**Result: PASS** (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (HTTP API contract)
│   └── api.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # App entry: wires Express, static frontend, and API
├── db.js                # Opens/initialises the SQLite database and schema
├── models/
│   └── bookmark.js      # Bookmark + tag data access and validation rules
├── services/
│   └── titleFetcher.js  # Best-effort page-title retrieval (server-side)
└── api/
    └── bookmarks.js     # HTTP route handlers for the bookmark/tag endpoints

web/                     # Static frontend served by the backend
├── index.html           # Single-page UI shell (list, add/edit, search, tags)
├── app.js               # UI logic: calls the API, renders list, handles search/filter
└── styles.css

tests/
├── integration/         # API-level tests via Supertest (spec acceptance scenarios)
│   └── bookmarks.test.js
└── unit/                # Model/validation and title-fetcher unit tests
    ├── bookmark.test.js
    └── titleFetcher.test.js

data/                    # Local SQLite file lives here at runtime (git-ignored)
```

**Structure Decision**: A single project with a thin backend (`src/`) and a
static frontend (`web/`). This is the simplest layout that still satisfies
FR-003 (server-side title fetching, which a pure browser app cannot do reliably
due to cross-origin restrictions) and FR-005 (durable local persistence). No
separate frontend build tooling is introduced, keeping the "run with one
command" goal intact.

## Complexity Tracking

> No constitution violations. Section intentionally left empty.
