# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, desktop-focused web app to save and manage bookmarks with
local-only persistence. Users save a URL (with optional title, description,
tags), browse and open bookmarks, edit (including the address) and delete them,
track unread/read-later status in a dedicated view, and archive/restore
bookmarks in a dedicated archive view. Saving an address that already exists
opens the existing bookmark for editing rather than creating a duplicate.

Technical approach: a small Node.js web application. A lightweight HTTP server
exposes a JSON REST API over a local embedded database and serves a
single-page browser UI. Everything runs in one process started with `npm start`
listening on `0.0.0.0:4000`, matching the review runtime.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express 5 (HTTP server + REST routing);
better-sqlite3 (synchronous embedded SQL storage). Frontend is dependency-free
vanilla JS + HTML + CSS (no build step).

**Storage**: SQLite database file on local disk (`data/bookmarks.db`), created
on first run. Single-user, local-only — no external services.

**Testing**: Node.js built-in test runner (`node --test`) for API/unit tests;
Playwright 1.61.0 (Node) for end-to-end browser validation of the core flows.

**Target Platform**: Modern desktop web browser (Chromium-based for automated
checks); server runs on Linux (Node 24) in the shared image.

**Project Type**: Web application (single deployable: API + served static SPA).

**Performance Goals**: Search/filter over 1,000 bookmarks returns in under 1s as
perceived by the user (SC-003); state toggles (read/archive) reflected under 1s
(SC-006). These are comfortably met by local SQLite queries.

**Constraints**: Local-only persistence, no auth, offline-capable. Server MUST
bind `0.0.0.0`, use port `4000`, and start via `npm start`. A visible ready
element is marked `data-harness-ready="true"` once initial UI + data load.

**Scale/Scope**: One user; low thousands of bookmarks; ~4 views (main list,
read-later, archive, add/edit form). No concurrency concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with placeholder principles and no ratified, enforceable rules. There
are therefore no concrete gates to evaluate. The plan nonetheless adheres to
sensible defaults consistent with the SDD method: spec-derived scope, minimal
dependencies, testable slices, and no scope beyond the approved spec.

**Result**: PASS (no defined constitutional constraints; no violations to
justify). Complexity Tracking left empty.

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
├── server.js            # App entry: builds Express app, binds 0.0.0.0:4000
├── db/
│   ├── connection.js    # Opens/creates SQLite database
│   └── schema.sql       # Table definitions (bookmarks, tags, bookmark_tags)
├── models/
│   └── bookmarks.js     # Data access + validation (CRUD, unique address, state)
├── services/
│   ├── url.js           # URL normalization + validation
│   └── title.js         # Best-effort title derivation from address/page
├── api/
│   └── routes.js        # REST endpoints under /api
└── web/
    ├── index.html       # Single-page UI shell (marks data-harness-ready)
    ├── app.js           # Views: list, read-later, archive, add/edit form
    └── styles.css       # Responsive desktop-first styling

tests/
├── unit/                # url normalization, model validation (node --test)
├── integration/         # API endpoint tests against a temp DB (node --test)
└── e2e/                 # Playwright flows: save, browse/open, edit, read, archive

data/                    # SQLite file created at runtime (gitignored)
package.json             # "start": "node src/server.js"; deps pinned
```

**Structure Decision**: Single web-application project (one Node process). The
API and the static SPA are served from the same Express server so the whole app
starts with `npm start` on port 4000, matching the runtime presentation
requirements. Layers (db / models / services / api / web) keep validation and
state logic testable independently of the HTTP and browser layers.

## Complexity Tracking

> No constitutional violations; section intentionally empty.
