# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

A single-user, local-first bookmark manager. The user saves web addresses; the app fetches
each page's details (title, description, site icon, preview image) automatically, keeps a
durable snapshot of the content (readable copy for web pages, the original file for PDFs),
and lets the user organize, search, read-later, archive, bulk-edit, import/export, save
searches, and remember preferences.

**Technical approach**: A **local-first web application** — a small local backend service paired
with a browser-based frontend, run on the user's own machine. A backend is required (not an
optional convenience) because several core requirements cannot be met by a browser alone:
fetching arbitrary third-party pages for metadata and snapshots is blocked by browser
cross-origin rules, and capturing/storing snapshots and PDFs and submitting to a public web
archive are server-side concerns. Data lives in a local database file plus a snapshot store on
disk, so nothing depends on an external account or network to read what's already saved.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) end-to-end — one language across backend and
frontend to reduce context switching for a solo project.

**Primary Dependencies**:
- Backend: a lightweight HTTP framework (Fastify), an HTML metadata/readable-content extractor
  (Open Graph / meta parsing + a Readability-style content extractor), and an HTTP fetcher.
- Frontend: React + Vite, with a small rich-text editor component for notes (headings, lists,
  bold/italic).
- Full-text search: SQLite FTS5 (built in), which natively supports AND / OR / NOT / grouped /
  exact-phrase queries — a direct fit for the spec's search requirements.

**Storage**: SQLite database file (bookmarks, tags, saved searches, preferences, snapshot
metadata) + a snapshot store on the local filesystem (readable HTML + assets for pages, original
files for PDFs). Single-user, no server database to administer.

**Testing**: Vitest for unit/service tests; API-level integration tests against the backend;
Playwright for end-to-end browser flows (save → list → open → snapshot).

**Target Platform**: Runs locally on macOS / Windows / Linux; used through a modern desktop
browser (Chrome, Firefox, Safari, Edge). No hosting or accounts required.

**Project Type**: Web application (frontend + backend) — see Project Structure.

**Performance Goals**: Search / filter / sort perceived as immediate (<1s) for up to 1,000
bookmarks (SC-004) — comfortably met by SQLite FTS5 on a local file. Metadata fetch and snapshot
capture run asynchronously so saving never blocks (SC-001).

**Constraints**: Local-first and offline for everything already saved (reading, searching,
snapshots). Network is needed only to fetch/save new pages or submit to a public archive.
Snapshot storage grows with the collection — the snapshot store is on disk (not in the DB) to
keep it manageable.

**Ease of launch (FR-035)**: A single launcher (one click / one command that starts the local
service and opens the app in the browser) — no multi-step ritual. Chosen so a non-technical user
can open it the same simple way every time.

**Backup & portability (FR-036)**: Because all durable data is a single database file plus the
`data/` folder, a complete backup is "copy the `data/` folder"; the app also provides an explicit
backup/restore action that packages links, notes, tags, state, and preferences so the user can
move to a new computer with no data loss. This full backup is distinct from the browser-format
export (FR-032), which exists for interoperability.

**Scale/Scope**: One user; designed to stay responsive from hundreds up to tens of thousands of
bookmarks. 12 user stories, 34 functional requirements + 1 optional (FR-027a).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated template with no
ratified principles, so there are no binding gates to enforce. Applying the spirit of the
default Spec Kit principles:

- **Simplicity / YAGNI**: One language, one local database, no external services required for the
  core loop. The optional web-archive submission (FR-027a) is isolated and deferrable. ✅
- **Test-first & integration testing**: Testing strategy defined (unit + API integration + E2E),
  to be expressed as tasks in the tasks phase. ✅
- **Observability / debuggability**: Local service with plain logs; snapshot store is inspectable
  files on disk. ✅

No violations; Complexity Tracking left empty. (Re-checked after Phase 1: still no violations.)

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contract)
│   └── api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Bookmark, Tag, Snapshot, SavedSearch, Preferences
│   ├── services/        # metadata fetch, snapshot capture (page + PDF), search,
│   │                    #   import/export, archive submission, dedupe/normalize
│   ├── routes/          # HTTP endpoints (see contracts/api.md)
│   ├── db/              # SQLite schema, migrations, FTS5 setup
│   └── server.ts
└── tests/
    ├── unit/
    └── integration/

frontend/
├── src/
│   ├── components/      # BookmarkList, BookmarkCard, TagInput, SearchBar,
│   │                    #   NotesEditor, SnapshotViewer, BulkActionBar
│   ├── pages/           # Main list, Read-later, Archive, Bookmark detail, Import/Export
│   ├── services/        # API client
│   └── app.tsx
└── tests/               # component + Playwright E2E

data/                    # created at runtime, git-ignored
├── bookmarks.db         # SQLite database
└── snapshots/           # readable HTML + assets, and original PDFs
```

**Structure Decision**: Web application with a `backend/` local service and a `frontend/` browser
app. This is driven by the requirements themselves: metadata fetching (FR-002), snapshot capture
(FR-026), PDF retention, and archive submission (FR-027a) all require a server-side fetcher that
a browser cannot provide due to cross-origin restrictions. SQLite + a filesystem snapshot store
keeps the whole thing local and account-free.

## Complexity Tracking

> No constitution violations; no entries required.
