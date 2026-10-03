# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A personal, single-user web application to save, browse, edit, delete, search, and
tag bookmarks, with data persisted locally so it survives restarts. Approach: a
small Node.js web server exposing a JSON API over a local SQLite database, serving
a lightweight browser UI (no heavy front-end build step). The server also performs
best-effort page-title fetching on save. This keeps the stack simple, matches the
review runtime (Node.js 24, `npm start`, port 4000), and satisfies the approved
assumptions (single user, desktop web, local persistence, no import/export).

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + JSON API + static file serving);
better-sqlite3 (embedded local database); Playwright 1.61.0 (end-to-end tests,
pinned to the image's browser revision). Front end is plain HTML/CSS/vanilla JS —
no framework or bundler.

**Storage**: SQLite database file on local disk (`data/bookmarks.db`). Single-file,
zero external service, fits single-user local persistence.

**Testing**: Node.js built-in test runner (`node --test`) for unit/API tests;
Playwright for end-to-end UI validation.

**Target Platform**: Modern desktop browser (Chromium/Firefox/Safari current). Server
runs on Linux (the shared image), listening on `0.0.0.0:4000`.

**Project Type**: Web application (single deployable: API + static UI served together).

**Performance Goals**: Interactive personal-scale use. List, search, and filter
render in under 1 second for collections of at least 200 bookmarks (supports SC-002).

**Constraints**: Server binds `0.0.0.0`, port 4000, started by `npm start` for the
review harness. Best-effort title fetch must never block or fail a save (short
timeout, graceful fallback). No external service dependency beyond fetching the
bookmarked pages themselves.

**Scale/Scope**: Single user; hundreds to low-thousands of bookmarks; ~4 UI views
(list/empty, add/edit form, search+tag filter, delete confirm).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified
template with no concrete principles defined, so there are no project-specific gates
to enforce. General good-practice gates applied instead:

- **Simplicity**: One deployable, one embedded datastore, no front-end build step,
  no premature abstraction. PASS.
- **Testability**: Each functional requirement maps to an API contract and a testable
  scenario (see quickstart.md). PASS.
- **Scope discipline**: Plan covers only the approved spec; no accounts, sync, or
  import/export. PASS.
- **Spec-first**: Plan derives strictly from the approved spec; no new behaviour
  introduced. PASS.

Result: **PASS** (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contract)
│   └── api.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # Express app: static serving + API routes, binds 0.0.0.0:4000
├── db.js                # SQLite connection + schema init/migration
├── bookmarks.js         # Bookmark data-access + business rules (validation, dedupe)
├── title-fetch.js       # Best-effort page-title fetch with timeout + fallback
└── url.js               # Address validation + normalisation helpers

public/
├── index.html           # Single-page UI shell (list, form, search/filter, empty states)
├── app.js               # UI logic: fetch API, render list, handle add/edit/delete/search
└── styles.css           # Styling

data/
└── bookmarks.db         # SQLite file (created at runtime; not committed)

tests/
├── unit/                # url normalisation/validation, dedupe, title fallback
├── api/                 # API contract tests (node --test against the server)
└── e2e/                 # Playwright: save, browse/open, edit, delete, search/filter

package.json             # scripts: start, test; deps pinned per runtime image
```

**Structure Decision**: Single web-application project rooted at the repository. The
Express server (`src/server.js`) both serves the static UI from `public/` and hosts
the JSON API, so one `npm start` command runs the whole app on port 4000 as the
review harness expects. Business logic is isolated in small modules under `src/` so it
is unit-testable without a browser; Playwright covers end-to-end user journeys.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
