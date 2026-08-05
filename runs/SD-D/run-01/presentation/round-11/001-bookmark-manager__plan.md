# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, local-first application to save, browse, organize, and manage web
bookmarks. The user saves a URL; the app fetches the page's title, favicon, and short
description, stores it locally, and lets the user tag, note (with basic formatting),
search, sort, edit, and delete bookmarks. The user can import an existing browser
bookmark export (preserving folders-as-tags and original save dates) and export the
whole collection back to a standard bookmark file.

**Technical approach**: A local web application — a small backend process on the user's
own machine, accessed through their browser. A backend is required (not a pure in-browser
app) because three core behaviors cannot be done from browser JavaScript alone: fetching
arbitrary pages' title/favicon/description (blocked by CORS in the browser), and parsing/
writing the Netscape bookmark HTML format for import/export. Bookmarks are stored in a
local SQLite database file, which comfortably handles the 5,000+ bookmark scale target and
provides case-insensitive full-text search.

**Single-action launch (FR-019)**: For a non-technical user, day-to-day startup must be
one action with no commands. To achieve this: the frontend is compiled to static files and
served by the *same* backend process, so there is exactly **one** thing to start (one
process, one local port). A packaged desktop launcher (a normal application icon / Start-menu
or Dock shortcut, produced with PyInstaller) starts that process and opens the user's
default browser to the app automatically, then keeps running quietly. The two-terminal /
dev-server workflow below exists only for development; the shipped experience is
"click the icon → the app is there." First-time install (placing the app + shortcut) is the
only setup and happens once.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript (frontend)

**Primary Dependencies**:
- Backend: FastAPI (HTTP API + serves the built frontend as static files), Uvicorn
  (server), SQLModel/SQLAlchemy (ORM over SQLite), httpx (fetch page metadata), selectolax
  or BeautifulSoup (parse HTML titles/meta/favicons and Netscape bookmark files), bleach
  (sanitize rich-text notes).
- Frontend: React + Vite, a lightweight rich-text editor (Tiptap) for formatted notes.
  Built to static assets and served by the backend (no separate server at runtime).
- Packaging/launch: PyInstaller to produce a one-click desktop launcher that starts the
  single local process and opens the default browser (FR-019).

**Storage**: Local SQLite database file (single-user, on the user's machine). SQLite FTS5
virtual table for full-text, case-insensitive search across title, URL, note, and tags.

**Testing**: Backend: pytest (unit + API/integration). Frontend: Vitest + React Testing
Library; Playwright for a small number of end-to-end flows (save, search, import/export).

**Target Platform**: Cross-platform desktop (Windows/macOS/Linux) — the user runs a local
process and uses it in their default browser at `http://localhost`. Fully offline-capable
except for the network fetch that enriches a newly saved bookmark.

**Project Type**: Web application (local backend + browser frontend).

**Performance Goals**:
- List/search results render within 1 second with 5,000+ bookmarks (SC-004).
- Metadata fetch on save is time-boxed (see Constraints) so a slow page never blocks
  saving (SC-001: save in under 15s).
- Import of 500 bookmarks completes in under 1 minute (SC-007).

**Constraints**:
- Metadata fetch (title/favicon/description) is time-boxed (~5s) and best-effort; on
  timeout/failure the bookmark still saves with the address as title and blank icon/
  description (FR-002, FR-002a).
- Rich-text notes are sanitized on the server (allowlist: links, bold, bullet lists) to
  keep stored/displayed HTML safe (FR-015).
- No user accounts, authentication, or network sync — single user, local only.
- Everyday launch must require a single action and no typed commands or config (FR-019,
  SC-009); a one-time install is acceptable.

**Scale/Scope**: One user; target up to ~5,000–10,000 bookmarks; 6 user stories, 18
functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified template
with placeholder principles, so there are no binding project-specific gates to evaluate.
In their absence, the plan holds itself to the baseline principles implied by the
template and by this project's SDD conventions:

- **Spec-first**: Every design element traces to an approved requirement (FR-xxx / SCxxx). ✅
- **Test-first**: Tasks will be ordered tests-before-implementation per user story. ✅ (enforced in `/speckit-tasks`)
- **Simplicity / YAGNI**: Smallest stack that meets the requirements; no accounts, no
  sync, no server infrastructure beyond a local process; SQLite over a client/server DB. ✅
- **Independently testable slices**: Structure and tasks preserve the spec's P1→P3 story
  ordering so each story ships and demos on its own. ✅

**Result**: PASS (no violations; Complexity Tracking left empty).

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
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Bookmark, Tag entities (SQLModel)
│   ├── services/        # metadata fetch, import (Netscape parse), export, search
│   ├── api/             # FastAPI routers: bookmarks, tags, import, export
│   ├── db/              # SQLite engine, FTS setup, migrations
│   ├── static/          # built frontend assets, served by the backend at runtime
│   └── launcher.py      # starts the process + opens the browser (FR-019 entry point)
└── tests/
    ├── unit/            # services, parsers, sanitizer
    ├── integration/     # API endpoints against a temp SQLite DB
    └── contract/        # request/response shape checks vs contracts/api.md

frontend/
├── src/
│   ├── components/      # BookmarkList, BookmarkCard, EditDialog, TagInput, NoteEditor, SearchBar, SortControl, ImportExport
│   ├── pages/           # main app view
│   └── services/        # API client
└── tests/               # component tests + Playwright e2e

packaging/
└── build.md / spec files # PyInstaller config to produce the one-click launcher + shortcut
```

**Structure Decision**: Web application (Option 2) — a `backend/` service and a
`frontend/` browser client. Chosen over a single-project/CLI layout because the feature
inherently spans a metadata-fetching + import/export backend and an interactive list/
edit/search UI. Kept to exactly two deployable pieces to honor the simplicity principle.

## Complexity Tracking

> No constitution violations — section intentionally empty.
