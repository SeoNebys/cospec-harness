# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, local bookmark manager. The user saves web links; the app
best-effort captures each page's title, site icon, and short description, and
lets the user organise with tags (with reuse suggestions), rich-text notes,
search (case-insensitive, quoted-phrase, multi-tag include/exclude), selectable
sort, archive, read-later, bulk actions (including "select everything matching"),
and import/export against the standard browser bookmark file.

**Technical approach**: A **local web application** — a lightweight backend
running on the user's own machine, opened in their browser at `localhost`. The
backend is required (not optional) for three reasons that a pure in-browser app
cannot satisfy: (1) fetching page metadata from arbitrary sites is blocked by
browser cross-origin rules; (2) reading/writing local import/export files; (3)
durable local persistence of a growing collection. No accounts, no network
service exposed beyond localhost, all data stays on the user's device.

## Technical Context

**Language/Version**: Backend Python 3.11; Frontend TypeScript (ES2022)

**Primary Dependencies**:
- Backend: FastAPI + Uvicorn (HTTP + serves the built UI), SQLModel/SQLAlchemy
  (data access over SQLite), httpx (metadata fetch), BeautifulSoup4 (parse page
  `<title>`/OpenGraph description/favicon and parse the Netscape bookmark file)
- Frontend: React + Vite; a small Markdown renderer for notes display

**Storage**: SQLite single-file database in the OS per-user data directory
(e.g. `~/.local/share/bookmark-manager/bookmarks.db`). Chosen over flat files
for indexed search/filter at 500–1000+ bookmarks and safe concurrent writes.

**Testing**: pytest (backend unit + API integration); Vitest (frontend unit);
Playwright (end-to-end, driving the quickstart acceptance scenarios)

**Target Platform**: Modern desktop browsers (Chrome, Firefox, Safari, Edge) on
the user's own Windows/macOS/Linux machine; backend runs locally.

**Project Type**: Local web application (backend + frontend, single deployable —
backend serves the built frontend).

**Performance Goals**:
- Search / tag-filter over a 1,000-bookmark collection returns in < 200 ms
  (SC-002 supports 500 in < 10 s from the user's perspective — easily met).
- Metadata capture is best-effort with a ~3 s timeout and never blocks saving
  (FR-003); the bookmark is saved immediately and enriched when metadata returns.
- Import of a 1,000-bookmark file completes and is searchable within a few
  seconds (SC-007); metadata for imported items is enriched in the background.
- A bulk action over a 600-item filtered set applies in one operation (SC-009).

**Constraints**: Offline-capable except for on-demand metadata fetch; binds to
localhost only (no external exposure); all data local; no telemetry.

**Scale/Scope**: One user, a personal collection realistically up to a few
thousand bookmarks; ~7 user stories, ~21 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is currently an
unpopulated template with no ratified principles, so there are no concrete gates
to enforce. In the absence of ratified rules, this plan adheres to the
template's evident spirit — **simplicity / YAGNI** and **testability**:

- **Simplicity**: One backend, one frontend, one embedded database, no accounts,
  no external services, no message queue/cache. See Complexity Tracking (none).
- **Test-first-friendly**: Every functional requirement maps to an API contract
  and an acceptance scenario that can be automated before implementation.

**Result: PASS** (no violations; nothing to justify in Complexity Tracking).

> If the project later ratifies a real constitution, re-run this gate.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions incl. export-fidelity & saved-search effort
├── data-model.md        # Phase 1 output — entities, fields, relationships
├── quickstart.md        # Phase 1 output — runnable validation of acceptance scenarios
├── contracts/           # Phase 1 output — REST API contract
│   └── api.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # From /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Bookmark, Tag, SavedSearch (SQLModel)
│   ├── services/        # metadata capture, import/export, search/filter, bulk ops
│   ├── api/             # FastAPI routers (bookmarks, tags, import/export, saved-searches)
│   └── app.py           # app wiring; serves built frontend + /api
└── tests/
    ├── unit/            # metadata parse, netscape parse, search parsing (quotes/tags)
    └── integration/     # API endpoint tests against a temp SQLite db

frontend/
├── src/
│   ├── components/      # list, editor, tag-input (autocomplete), filter bar, bulk bar
│   ├── pages/           # main collection, archive view
│   └── api/             # typed client for the backend contract
└── tests/               # Vitest unit tests

e2e/
└── *.spec.ts            # Playwright scenarios mirroring quickstart.md
```

**Structure Decision**: Local web application. A single FastAPI process serves
both the JSON API under `/api` and the built React bundle, so the user launches
one thing and opens one URL. Backend and frontend are separated only for build
tooling and testing clarity, not deployed as separate services.

## Complexity Tracking

No constitution violations. No entries. (Single deployable, single datastore,
no accounts, no external infrastructure — deliberately minimal.)
