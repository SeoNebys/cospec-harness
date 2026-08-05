# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a single-user, local bookmark app the client runs on their own machine and
uses in their browser. It lets them save bookmarks (auto-titled, with validation
and duplicate warnings), browse/search/filter by keyword and tag, organize with
tags, and edit/delete with undo. Approach: a small local TypeScript server
(storage, validation, title retrieval, dedupe) exposing a JSON API, plus a
single-page browser UI; data persists in a local SQLite file. See
[research.md](research.md) for the decisions behind this.

## Technical Context

**Language/Version**: TypeScript on Node.js (LTS).

**Primary Dependencies**: Local HTTP server (Fastify or equivalent); SQLite access
(better-sqlite3 or equivalent); Vite + React for the single-page UI; an HTML
parser for title extraction.

**Storage**: Single local SQLite database file on the user's machine.

**Testing**: Vitest (server unit/integration); Playwright (end-to-end browser).

**Target Platform**: The user's local machine; used via a modern web browser at
`http://localhost`.

**Project Type**: Local web application (server + browser UI in one project).

**Performance Goals**: Search/filter results within ~1s for up to 5,000 bookmarks
(SC-003); list and search stay responsive into the thousands.

**Constraints**: Runs fully offline/local; no accounts, no external hosting; all
data stays on the machine. Graceful degradation when a page's title can't be
fetched.

**Scale/Scope**: One user; collections up to several thousand bookmarks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unfilled
template with no ratified principles, so there are no binding gates to evaluate.
The plan nonetheless holds to the project's SDD conventions (spec-first, gated
review) and keeps the design as simple as the spec allows (single project,
single local datastore, no speculative features).

**Result**: PASS (no constitution violations; no entries in Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── spec.md              # Approved specification
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   └── api.md           # Phase 1 local API contract
└── tasks.md             # Created by /speckit-tasks (not yet)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── index.ts          # Local server entry; serves API + built UI
│   ├── db.ts             # SQLite connection + schema/migrations
│   ├── routes/
│   │   ├── bookmarks.ts   # /api/bookmarks endpoints
│   │   └── tags.ts        # /api/tags endpoints
│   └── services/
│       ├── url.ts         # validation + normalization (FR-002, FR-014)
│       ├── title.ts       # page-title retrieval with fallback (FR-003)
│       ├── bookmarks.ts   # save/list/search/edit/delete+undo (FR-001,006-014)
│       └── tags.ts        # tag assign/rename/remove/filter (FR-009, FR-010)
└── web/
    ├── main.tsx          # SPA entry
    ├── components/       # list, search bar, tag filter, editor, undo toast
    └── api.ts            # typed client for the local API

tests/
├── unit/                 # url, title, dedupe, tag propagation
├── integration/          # API endpoints against a temp SQLite db
└── e2e/                  # Playwright: save → find → open journey
```

**Structure Decision**: A single project with a `server/` and `web/` split under
`src/`. This matches the "one local web application" shape from research
(Decision 1/3): the server owns storage and the operations the browser can't do,
the web app is the UI, and one codebase in one language keeps a single-user tool
easy to run and maintain.

## Complexity Tracking

No constitution violations; no justifications required.
