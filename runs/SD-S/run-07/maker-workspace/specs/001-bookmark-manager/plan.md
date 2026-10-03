# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

Build a single-user web application to save, find, organize, and manage web
bookmarks. Users save a bookmark by entering a web address (title auto-derived
with fallback to the address), browse all bookmarks newest-first, search by
keyword, edit/delete with confirmation, and organize with tags including filter.
Data persists locally and survives restarts.

**Technical approach**: A single Node.js service exposes a small JSON HTTP API and
serves a lightweight browser UI. Bookmarks and tags persist in a local SQLite
database file so data survives restarts with no external services. Title
derivation fetches the target page's `<title>` server-side with a graceful
fallback to the address. The server listens on `0.0.0.0:4000` and is started with
`npm start`, per the runtime presentation environment.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + static hosting), `node:sqlite`
(Node.js 24 built-in SQLite, `DatabaseSync`, for embedded local persistence),
node-html-parser (extract page `<title>` for title derivation). Frontend is
dependency-free HTML/CSS/vanilla JavaScript.

> Implementation note: the plan originally named `better-sqlite3` as the SQLite
> driver. During implementation its native addon triggered a teardown crash
> (`RemoveEnvironmentCleanupHook` assertion) under the test runner in this
> environment, so it was replaced with Node.js 24's built-in `node:sqlite`. The
> storage decision (a local SQLite database file) is unchanged; only the access
> driver changed, and this removed one third-party dependency.

**Storage**: Local SQLite database file (`data/bookmarks.db`) — no external
database or network service required.

**Testing**: Node's built-in test runner (`node:test`) for unit/API tests;
Playwright 1.61.0 (pinned) for end-to-end browser validation of the primary user
journeys.

**Target Platform**: Modern desktop/laptop web browser (Chromium verified);
server runs on Linux (Node.js 24).

**Project Type**: Web application (single service serving API + static frontend).

**Performance Goals**: Bookmark list visible and interactive within 2 seconds for
up to 500 bookmarks (SC-005); search returns matches for a collection of 100 in
well under the 10-second locate target (SC-002).

**Constraints**: Single-user, offline-capable except for optional title fetch;
listens on `0.0.0.0:4000` (final application) with `npm start`; HTTP-session
cookies not required (no auth in v1); title-fetch failures must degrade
gracefully.

**Scale/Scope**: Single user; designed to remain responsive to at least 500–1000
bookmarks; ~4 user journeys, one primary screen (list + save/edit + search/tag
filter).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no explicit gates to enforce.
Applying general good-practice defaults instead:

- **Simplicity**: Single service, single local database file, no external
  dependencies or services. PASS.
- **Spec alignment**: Plan covers all v1 requirements (FR-001…FR-014) and the
  approved scope (single-user, local-only, tagging included). PASS.
- **Testability**: Each user story is independently testable via the API and
  Playwright E2E flows. PASS.

No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── api.md           # HTTP API contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # App entry: Express app, static hosting, listen 0.0.0.0:4000
├── db.js                # SQLite connection + schema initialization/migration
├── models/
│   └── bookmark.js      # Bookmark + tag data access (create/list/search/update/delete)
├── services/
│   └── titleFetcher.js  # Fetch target page and extract <title>, fallback to address
└── routes/
    └── bookmarks.js     # JSON API route handlers (/api/bookmarks, /api/tags)

public/                  # Static frontend served by the server
├── index.html           # Single-page UI (list, save/edit form, search, tag filter)
├── app.js               # Vanilla JS: calls API, renders list, empty/no-results states
└── styles.css           # Styling

tests/
├── unit/                # node:test — title derivation, validation, dedupe
├── api/                 # node:test — API contract behavior
└── e2e/                 # Playwright — primary user journeys

data/                    # SQLite database file lives here (created at runtime)
package.json             # scripts: start, test, test:e2e; pinned deps
```

**Structure Decision**: Single Node.js web application. The Express server both
serves the static frontend in `public/` and exposes the JSON API under `/api`,
keeping deployment to a single `npm start` process on port 4000. Persistence is a
local SQLite file under `data/`. This is the simplest structure that satisfies
the local-only, single-user v1 scope while keeping models, services, and routes
separated for testability.

## Complexity Tracking

> No constitution violations; section intentionally left empty.
