# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application to save, browse, search, edit, delete, and tag
bookmarks, with bookmarks persisted locally so they survive restarts. The
approach is a small Node.js web service that exposes a JSON REST API and serves
a lightweight browser UI; bookmarks and tags are stored in a local SQLite file.
The whole app runs from a single `npm start` on `0.0.0.0:4000`, matching the
review runtime environment.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + REST routing); better-sqlite3
(synchronous, file-based SQLite driver); vanilla HTML/CSS/JS for the frontend
(no framework, served as static assets). Playwright 1.61.0 (dev only) for
end-to-end validation.

**Storage**: SQLite database file on local disk (`data/bookmarks.db`). Single
file, no external database server — fits the single-user, local-persistence
requirement.

**Testing**: Node's built-in test runner (`node --test`) for unit/integration
of the API layer; Playwright for browser end-to-end scenarios.

**Target Platform**: Modern desktop web browser (Chromium-based for automated
checks). Server runs on Linux (Node 24) listening on `0.0.0.0:4000`.

**Project Type**: Web application (single deployable: API + served static UI).

**Performance Goals**: Interactive single-user use. List/search of a collection
of up to a few thousand bookmarks returns in well under 1 second; supports the
spec's SC-002 (find one among 100 in under 10 seconds).

**Constraints**: Must listen on `0.0.0.0:4000` and start via `npm start`
(per project runtime rules). Offline/local — no external network dependency at
runtime. Layout usable down to small screen widths.

**Scale/Scope**: One user, one machine. ~4 entities of UI (list, add/edit form,
search bar, tag filter). Hundreds to low thousands of bookmarks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified
template containing only placeholder principles — no concrete, enforceable
gates are defined. There are therefore no constitution constraints to violate.

Self-applied sanity gates, all satisfied:

- **Simplicity**: Single project, single storage file, no framework on the
  frontend, minimal dependencies. PASS.
- **Spec fidelity**: Every functional requirement (FR-001–FR-012) maps to a
  planned API endpoint and/or UI element (see data-model and contracts). PASS.
- **Testability**: API contracts and quickstart define observable behaviour
  that can be validated without inspecting internals. PASS.

No violations; Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # REST API contract
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # App entry: creates Express app, listens on 0.0.0.0:4000
├── db.js                # SQLite connection + schema initialization/migration
├── repository.js        # Data access: CRUD for bookmarks and tags
├── routes/
│   └── bookmarks.js     # REST route handlers for /api/bookmarks
└── lib/
    └── url.js           # URL validation + normalization helpers

public/                  # Static frontend served by the server
├── index.html           # Single-page UI (list, add/edit form, search, tag filter)
├── app.js               # Frontend logic: fetch API, render, events
└── styles.css           # Responsive styling + empty/no-results states

tests/
├── unit/
│   └── url.test.js      # URL validation/normalization
├── integration/
│   └── api.test.js      # API endpoints against a temp SQLite db
└── e2e/
    └── bookmarks.spec.js # Playwright: save/browse/edit/delete/tag flows

data/                    # Runtime SQLite file (gitignored); created on first run
package.json             # "start" script → node src/server.js
```

**Structure Decision**: Single-project web application. The Node/Express server
both serves the REST API under `/api` and the static frontend from `public/`,
so the entire app is one process started by `npm start` — the simplest layout
that satisfies the runtime-presentation requirement (one port, one command).
Business logic is split into a thin route layer, a repository (data access), and
small pure helpers (URL handling) so each is independently testable.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
