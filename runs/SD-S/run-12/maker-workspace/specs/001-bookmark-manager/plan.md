# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

Deliver a single-user, locally-stored desktop web app for saving and managing
bookmarks. A small Node.js/Express server serves a static browser client and a JSON
REST API; bookmarks (with optional title, notes, and tags) persist in a local SQLite
file so they survive restarts. The client covers the four prioritized user journeys:
save (P1), browse & open (P1), edit & delete (P2), and search/tag organize (P3). URL
validation and `https://` normalization happen on both client and server.

## Technical Context

**Language/Version**: JavaScript (ES modules) on Node.js 24; modern browser JS, no build step.

**Primary Dependencies**: Express 4 (HTTP + static hosting), `better-sqlite3` (storage). Dev: `@playwright/test` pinned to `1.61.0`.

**Storage**: SQLite database file under `/work/data/` (created on first run).

**Testing**: `node:test` for unit/API tests; Playwright `1.61.0` for one end-to-end browser flow.

**Target Platform**: Modern desktop web browser; server on Linux (Node 24), bound to `0.0.0.0:4000`.

**Project Type**: Web application (server-hosted SPA-style client + REST API), single project layout.

**Performance Goals**: Instant interactions at expected scale (hundreds of bookmarks); locate a bookmark among 200 in under 10s via search/filter (SC-003).

**Constraints**: Single local user, no login; durable persistence with zero data loss across restarts (SC-004); served via foreground `npm start` on port 4000; root UI marks `data-harness-ready="true"` after initial load.

**Scale/Scope**: One user, ~hundreds of bookmarks, a handful of screens/views and ~6 API endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no concrete gates to enforce. No
violations. The plan nonetheless follows sensible defaults: minimal dependencies, no
premature abstraction, tests for the core behaviours, and a single small project.

**Initial check**: PASS (no principles defined).
**Post-design re-check**: PASS — design introduces no unjustified complexity
(single project, three entities, ~6 endpoints, no build step).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── spec.md              # Approved specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output — REST contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
/work/
├── package.json         # scripts: start, test; dependencies
├── server/
│   ├── index.js         # Express app: static hosting + API, binds 0.0.0.0:4000
│   ├── db.js            # SQLite connection + schema init (data/bookmarks.db)
│   ├── bookmarks.js     # Bookmark + tag data access (CRUD, search, filter)
│   └── url.js           # URL normalization + validation (shared logic)
├── public/              # Static browser client (served by the server)
│   ├── index.html       # App shell; sets data-harness-ready after load
│   ├── app.js           # UI logic: fetch API, render list, forms, search/filter
│   └── styles.css       # Layout/styling (usable on smaller screens)
├── tests/
│   ├── url.test.js      # Unit: normalization/validation (FR-002/FR-003)
│   ├── api.test.js      # API: CRUD, duplicate warn, search/filter, ordering
│   └── e2e.spec.js      # Playwright: save→list→open→edit→delete flow
├── data/                # SQLite file (gitignored; created at runtime)
└── .harness/app.json    # Runtime declaration (kind: application, port 4000)
```

**Structure Decision**: Single project (no separate frontend/backend repos). The
Express server both hosts the static client from `public/` and serves the REST API
under `/api`, so one `npm start` satisfies the runtime contract. Data access is
isolated in `server/` modules; URL logic lives in one module reused by API and tests.

## Complexity Tracking

No constitution violations; no complexity to justify.
