# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/work/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web app to save, browse, manage, tag, and search bookmarks. The
approach is one Node.js (Express) application that serves a small JSON REST API
and a static vanilla-JS single-page frontend from the same origin on port 4000.
Bookmarks persist in a local SQLite file so they survive reloads and restarts.
Web addresses are validated and normalized (http/https only); page titles are
fetched best-effort on save with a timeout and fallback to the address. Search
and tag filtering are handled server-side. See [research.md](./research.md) for
the decisions behind this stack.

## Technical Context

**Language/Version**: JavaScript on Node.js 24 (ES modules)

**Primary Dependencies**: Express (HTTP + static serving); better-sqlite3
(persistence); built-in global `fetch` (best-effort title retrieval); no
frontend framework (vanilla HTML/CSS/JS)

**Storage**: SQLite database file under `data/` (created on first run)

**Testing**: `node:test` for unit tests; Playwright 1.61.0 (pinned to match the
environment's browser binaries) for end-to-end tests

**Target Platform**: Modern desktop web browser; server runs on Node.js 24 in the
shared Linux environment

**Project Type**: Web application (single deployable: API + static frontend)

**Performance Goals**: Save a bookmark in under 20s including best-effort title
fetch (SC-001, title fetch capped at ~5s); find one of 100 bookmarks in under 10s
via search/filter (SC-003)

**Constraints**: Listen on `0.0.0.0:4000`; no external services; single-user;
http/https bookmarks only; title fetching must never block or fail a save

**Scale/Scope**: Single user; on the order of hundreds to a few thousand
bookmarks; ~4 user stories, one entity plus tags

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no concrete gates to enforce.
The plan nonetheless follows sound defaults consistent with the template's
spirit: simplicity (single project, minimal dependencies, no build step),
testability (unit + e2e coverage of the acceptance scenarios), and no external
service dependencies.

- **Initial check (pre-Phase 0)**: PASS — no violations; no complexity to justify.
- **Post-design re-check (post-Phase 1)**: PASS — the design remains a single
  small project with one data entity plus tags; no deviations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Approved specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output — REST + UI contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
/work/
├── package.json             # scripts: start, test, test:e2e; deps pinned
├── server/
│   ├── index.js             # App entry: creates server, listens 0.0.0.0:4000
│   ├── app.js               # Express app: routes + static frontend wiring
│   ├── db.js                # SQLite connection + schema init/migrations
│   ├── bookmarks.repo.js    # Data access for bookmarks + tags
│   ├── routes/
│   │   ├── bookmarks.js      # /api/bookmarks CRUD + list/search/filter
│   │   └── tags.js           # /api/tags
│   └── lib/
│       ├── url.js            # Validation + normalization (http/https)
│       └── title.js          # Best-effort page-title fetch + extraction
├── public/                  # Static frontend (served by Express)
│   ├── index.html           # Root UI; sets data-harness-ready when loaded
│   ├── app.js               # List/add/edit/delete, tags, search UI logic
│   └── styles.css
├── data/                    # SQLite file lives here (gitignored)
├── tests/
│   ├── unit/                # node:test — url.js, title.js, repo logic
│   └── e2e/                 # Playwright 1.61.0 — acceptance flows
└── .harness/
    └── app.json             # kind: application, port 4000, start ["npm","start"]
```

**Structure Decision**: Single web-application project. API and static frontend
ship from one Express server on port 4000 (same origin — no CORS/session
complexity). Server code under `server/`, static client under `public/`,
SQLite file under `data/`, tests split into `unit/` and `e2e/`. This matches the
runtime presentation requirements in the project conventions.

## Complexity Tracking

No constitution violations; no additional complexity requires justification.
