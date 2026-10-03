# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application for saving and managing personal bookmarks. Users
manually add links (address plus optional title, note, and free-text tags), then
browse, search, tag-filter, edit, delete, and open them. Bookmarks persist across
restarts. The approach is a small Node.js web service exposing a JSON REST API
backed by a file-based SQLite database, with a lightweight server-rendered/static
HTML+CSS+vanilla-JS front end served from the same origin. This keeps the stack
minimal, dependency-light, and easy to run in the review environment on port 4000.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + routing); better-sqlite3 (embedded
SQLite driver). Front end uses no framework — plain HTML, CSS, and vanilla JS.

**Storage**: SQLite database file on local disk (`data/bookmarks.db`). Single file,
zero external service, survives restarts.

**Testing**: Node built-in test runner (`node --test`) for unit/integration of the
API and data layer; Playwright 1.61.0 (pinned) for an end-to-end browser check of
the primary user flow.

**Target Platform**: Modern desktop web browser (Chromium/Firefox/Safari); server
runs on Linux (Node.js).

**Project Type**: Web application (single deployable: API + served static front end).

**Performance Goals**: Search/filter results render within 1 second for up to 1,000
bookmarks (SC-005); typical interactions feel instant (<200ms server response).

**Constraints**: Runs offline/local; single user, no authentication; server listens
on `0.0.0.0:4000`; no external network calls required for core features.

**Scale/Scope**: Personal collection, hundreds to low thousands of bookmarks; ~4
screens/views (list, add/edit form, search/filter, empty states).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unfilled template
with no ratified principles, so there are no project-specific gates to enforce.
Default engineering guardrails adopted for this feature: keep the stack simple
(YAGNI), prefer standard library and few dependencies, and keep the feature a single
deployable unit. **Result: PASS** (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST API contract)
│   └── api.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # App entry: Express app, static serving, listen on 0.0.0.0:4000
├── db.js                # SQLite connection + schema init/migration
├── repository.js        # Data-access functions for bookmarks (CRUD, search, filter)
├── routes/
│   └── bookmarks.js     # REST endpoints for /api/bookmarks
└── lib/
    └── validation.js    # Address validation, input normalization, duplicate check

public/                  # Served static front end
├── index.html           # Single-page UI (list, add/edit form, search/filter)
├── styles.css
└── app.js               # Fetch-based client calling the REST API

data/
└── bookmarks.db         # SQLite file (created at runtime; gitignored)

tests/
├── unit/                # validation + repository unit tests (node --test)
├── integration/         # API endpoint tests (node --test)
└── e2e/                 # Playwright browser test of primary flow
```

**Structure Decision**: Single web-application project (not split into separate
frontend/backend packages). One Node.js process serves both the JSON API under
`/api` and the static front end from `public/`, which is the simplest layout that
satisfies same-origin cookies/requests and the port-4000 review requirement.

## Complexity Tracking

No constitution violations; this section is intentionally empty.
