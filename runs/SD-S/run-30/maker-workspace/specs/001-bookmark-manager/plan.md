# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a single-user, no-login web app for saving and managing bookmarks. A person
saves a URL (with an auto-derived title, optional note, and tags), then browses,
searches, filters by tag, opens, edits, and deletes bookmarks; everything
persists across restarts. Technical approach: a small Node.js 24 + Express server
exposing a JSON REST API over a SQLite database, serving a single vanilla-JS
static page as the UI. See [research.md](research.md) for the decision rationale.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express 4 (HTTP server + static hosting),
`better-sqlite3` (embedded database). Dev/test: Playwright `1.61.0`.

**Storage**: SQLite, single file at `data/bookmarks.db` (durable across restarts).

**Testing**: `node:test` (API/integration); Playwright `1.61.0` (e2e smoke).

**Target Platform**: Linux container; served on `0.0.0.0:4000`, reached by the
client at `http://maker:4000` (VM capture at `http://127.0.0.1:4000`).

**Project Type**: Web application (single project: API + static frontend in one
Node process).

**Performance Goals**: Search results < 1s over 1,000+ bookmarks (SC-003); locate
a bookmark among 500+ in < 10s via search/tag filter (SC-002).

**Constraints**: No external services (self-contained SQLite); saves must not be
blocked by best-effort title fetch; UI signals readiness via
`data-harness-ready="true"`.

**Scale/Scope**: Single user; on the order of 1,000+ bookmarks; ~6 API endpoints;
one UI page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no explicit constitutional
gates to enforce. Applying the default engineering principles it implies
(simplicity / YAGNI, testability, clear structure):

- **Simplicity**: single Node process, one small dependency for storage, no
  frontend framework — PASS.
- **Testability**: API is pure JSON with deterministic behavior; storage is a
  local file; e2e via Playwright — PASS.
- **No unjustified complexity**: no multi-service or account system (single-user
  per FR-015) — PASS.

**Result**: PASS (initial and post-design). No entries required in Complexity
Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
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
/work
├── package.json              # scripts: start, test; deps
├── package-lock.json         # preserved lockfile
├── server/
│   ├── index.js              # Express app + static hosting + startup (0.0.0.0:4000)
│   ├── db.js                 # SQLite init, schema, prepared queries
│   ├── routes/
│   │   └── bookmarks.js      # /api/bookmarks + /api/tags handlers
│   ├── url.js                # WHATWG URL validation + normalization (dedupe)
│   └── title.js              # best-effort <title> fetch with fallback to URL
├── public/
│   ├── index.html            # single-page UI shell (sets data-harness-ready)
│   ├── app.js                # list/search/filter/add/edit/delete via fetch
│   └── styles.css            # layout & styling
├── data/                     # SQLite database file (created at runtime)
├── tests/
│   ├── api.test.js           # node:test API/integration
│   └── e2e.spec.js           # Playwright smoke: save → list → search
└── .harness/
    └── app.json              # runtime descriptor (kind: application, port 4000)
```

**Structure Decision**: Single-project web application. One Node process serves
both the JSON API (`server/`) and the static UI (`public/`) on port 4000, keeping
deployment and the review-runtime setup trivial. SQLite lives in `data/` so
bookmarks persist across restarts with no external service.

## Implementation phases (high level)

Ordered to keep each spec user story independently demonstrable (MVP-first):

1. **Foundation**: project scaffolding (`package.json`, Express server, static
   hosting), SQLite schema and connection, `.harness/app.json`, readiness marker.
2. **US1 — Save (P1)**: POST create with URL validation, dedupe, best-effort
   title; list render; empty state. Delivers the MVP.
3. **US2 — Browse/search/open (P2)**: GET list newest-first, keyword search,
   open-in-new-tab, no-results state.
4. **US3 — Organize (P2)**: tags + notes on create/edit; GET tags; tag filter.
5. **US4 — Edit/delete (P3)**: PUT edit, DELETE with UI confirmation step.
6. **Validation**: tests (`node:test` + Playwright), quickstart run-through,
   persistence check across restart.

## Complexity Tracking

No constitution violations; no entries required.
