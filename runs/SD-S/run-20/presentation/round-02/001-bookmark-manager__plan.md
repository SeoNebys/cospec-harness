# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Deliver a single-user, browser-based bookmark manager that lets a user save web
addresses (with optional titles and tags), browse them newest-first, open them in
a new tab, edit and delete them, and find them via tag filter and text search.
Technical approach: one Node.js (Express) service that serves a dependency-light
vanilla JS frontend and a JSON REST API from the same origin on port 4000, with
durable SQLite file storage. Server-side validation normalizes addresses and
tags; user content is always rendered as text. See [research.md](./research.md)
for decisions, [data-model.md](./data-model.md) for entities, and
[contracts/api.md](./contracts/api.md) for the API.

## Technical Context

**Language/Version**: JavaScript on Node.js 24 (ES modules)

**Primary Dependencies**: Express (HTTP + static serving); `better-sqlite3`
(storage); `@playwright/test` @ 1.61.0 (E2E, dev only). Frontend is vanilla
HTML/CSS/JS — no framework or bundler.

**Storage**: SQLite single file at `data/bookmarks.db` via `better-sqlite3`.

**Testing**: `node:test` (built-in) for API/unit; `@playwright/test` 1.61.0 +
Chromium for end-to-end UI journeys.

**Target Platform**: Linux container; modern browser client. Server listens on
`0.0.0.0:4000` (review at `http://maker:4000`, capture at `http://127.0.0.1:4000`).

**Project Type**: Web application (single service serving API + static frontend).

**Performance Goals**: List view interactive within 2s for up to 500 bookmarks
(SC-004); search/filter result located in under 10s at 100+ bookmarks (SC-003).

**Constraints**: Single origin/port; one foreground `npm start` command; no
external services; durable across restarts (SC-002); user content rendered safely
(FR-014); Playwright pinned to the installed browser revision (1.61.0).

**Scale/Scope**: One user; up to ~500 bookmarks; one primary screen (list + save
form + edit/delete + tag filter + search).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is an unpopulated
template (no ratified principles or version). There are therefore no governance
gates to enforce. **Result: PASS (no applicable constraints).**

If a constitution is later ratified, re-run this check against it. Post-design
re-evaluation: still PASS — the design introduces no complexity requiring
justification (single project, no extra services, minimal dependencies). The
Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities & rules
├── quickstart.md        # Phase 1 run & validation guide
├── contracts/
│   └── api.md           # Phase 1 REST API contract
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
/work/
├── package.json             # scripts: start, test, test:e2e; pinned deps
├── package-lock.json        # preserved lockfile
├── server/
│   ├── index.js             # app entry: create app, listen on 0.0.0.0:4000
│   ├── app.js               # Express app: static serving, routes, security headers
│   ├── db.js                # SQLite connection + schema init/migration
│   ├── bookmarks.js         # data access + validation/normalization (VR-1..VR-6)
│   └── routes.js            # /api/bookmarks, /api/tags handlers (per contract)
├── public/                  # static frontend (no build step)
│   ├── index.html           # single screen; sets data-harness-ready when loaded
│   ├── app.js               # fetch API calls, DOM rendering via textContent
│   └── styles.css
├── data/                    # SQLite file lives here (created at runtime)
└── tests/
    ├── api/                 # node:test API/unit specs
    │   ├── validation.test.js
    │   ├── crud.test.js
    │   └── search-filter.test.js
    └── e2e/                 # @playwright/test UI journeys (1.61.0)
        ├── save-browse.spec.js
        └── edit-delete-search.spec.js
```

**Structure Decision**: Single web-application project rooted at `/work`. One
Express service serves both the static frontend (`public/`) and the JSON API
(`server/`), matching the same-origin, single-port review model. `start_cwd`
stays `/work`; `npm start` is the sole foreground command the harness runs.

## Implementation phases (high level)

The detailed, dependency-ordered breakdown is produced by `/speckit-tasks`. At a
high level, implementation proceeds by user-story slice so each is independently
demonstrable:

1. **Foundation**: project scaffold (`package.json`, scripts), Express app,
   SQLite schema, security headers, static serving, health of empty state.
2. **Story 1 (P1) — Save**: POST create with validation/normalization + duplicate
   warning; save form UI.
3. **Story 2 (P1) — Browse & open**: GET list newest-first; list UI, open-in-new-
   tab, empty state, `data-harness-ready` marker.
4. **Story 3 (P2) — Edit & delete**: PUT + DELETE endpoints; edit form and
   confirmed delete UI.
5. **Story 4 (P3) — Organize & find**: tags on create/edit, GET `/api/tags`,
   `q` + `tag` filtering; search box, tag filter control, "no results" state.
6. **Validation**: node:test API suite + Playwright E2E per `quickstart.md`;
   write `/work/.harness/app.json` for review.

## Complexity Tracking

No constitution violations and no complexity requiring justification. Table
intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |
