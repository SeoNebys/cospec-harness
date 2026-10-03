# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-based bookmark manager. The user saves links; the app
automatically captures title/description/favicon/preview image, keeps a
self-contained preserved copy of each page (and the original file for PDFs), and
optionally submits the page to the Internet Archive. Bookmarks are organized with
tags and reusable saved views, found with a case-insensitive advanced search
(phrases, `#tag`, AND/OR/NOT, parentheses), and managed with read-later, archive,
bulk actions, sorting, notes, import/export (Netscape HTML), and display
preferences.

**Technical approach**: A Node.js web application — a Fastify HTTP API plus a
React single-page front end built with Vite — backed by a local SQLite database
(with FTS5 full-text index) and a files-on-disk store for preserved page
snapshots and PDFs. Metadata capture and page preservation use the
already-installed Playwright + Chromium. The advanced search grammar is parsed
into an AST and compiled to SQL that combines FTS5 text matching with tag
membership under the query's boolean logic. The server listens on `0.0.0.0:4000`.

## Technical Context

**Language/Version**: TypeScript on Node.js 24 (backend and frontend).

**Primary Dependencies**:
- Backend: Fastify (HTTP), `better-sqlite3` (embedded DB + FTS5), `zod` (input validation), `cheerio` (metadata + Netscape HTML parse/build), Playwright 1.61.0 (Chromium — metadata render + self-contained snapshot capture).
- Frontend: React + Vite, a small markdown renderer for notes (e.g. `marked` + sanitizer), no heavy UI framework.

**Storage**:
- SQLite database file at `data/bookmarks.db` (bookmarks, tags, saved views, preferences) with an FTS5 virtual table for search.
- Filesystem under `data/snapshots/<bookmark-id>/` for the preserved copy (single-file HTML) and retained PDFs.

**Testing**: Vitest for unit/integration (search-parser, import/export, metadata parsing, API routes with an in-memory/temp SQLite DB); Playwright Test (pinned 1.61.0) for a small set of end-to-end UI checks.

**Target Platform**: Linux container; served over HTTP on `0.0.0.0:4000`; accessed via a modern browser at `http://maker:4000`.

**Project Type**: Web application (single-page frontend + API backend, one repo).

**Performance Goals**: Search over 500 bookmarks < 1s (SC-002); bulk action over ≤500 matches < 5s (SC-005); import of 1,000 entries preserves 100% titles/tags/dates with no duplicates (SC-006). Metadata/snapshot capture runs asynchronously so it never blocks the save response.

**Constraints**: Single-user, no authentication. Save must return promptly even when a target site is slow/unreachable (capture is backgrounded). Internet Archive and metadata capture require outbound network and degrade gracefully. Preserved copies grow disk usage; store them as files, not DB blobs.

**Scale/Scope**: One user; design target on the order of 10k bookmarks; 13 user stories, ~29 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is an unratified
template (placeholder principles only), so there are no project-specific gates to
enforce. In its absence the plan holds itself to these general gates, all of which
it satisfies:

- **Spec-first**: Plan derives entirely from the approved spec; no scope added beyond it. ✅
- **Testable**: Each user story has independent acceptance scenarios; search parser, import/export, and metadata parsing are pure and unit-testable. ✅
- **Simplicity / YAGNI**: One repo, one embedded database, one background worker in-process; no microservices, no external DB server, no auth system (not required for single-user). ✅
- **Observability**: Structured server logs (Fastify logger) including capture/Internet-Archive successes and failures. ✅

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output — key technical decisions
├── data-model.md        # Phase 1 output — entities, schema, FTS, states
├── quickstart.md        # Phase 1 output — how to run & validate
├── contracts/           # Phase 1 output — HTTP API + search grammar
│   ├── api.md
│   └── search-grammar.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── server.ts                 # Fastify bootstrap, listens 0.0.0.0:4000, serves built frontend
│   ├── db/
│   │   ├── schema.sql            # Tables + FTS5 virtual table + triggers
│   │   └── db.ts                 # better-sqlite3 connection, migrations
│   ├── models/                   # Bookmark, Tag, SavedView, Preferences data access
│   ├── services/
│   │   ├── metadata.ts           # Fetch/parse title, description, favicon, preview image
│   │   ├── snapshot.ts           # Playwright self-contained snapshot + PDF retention
│   │   ├── archiveOrg.ts         # Internet Archive submission (best-effort)
│   │   ├── search/
│   │   │   ├── parser.ts         # Query string -> AST (phrases, #tag, AND/OR/NOT, parens)
│   │   │   └── compile.ts        # AST -> SQL (FTS5 MATCH + tag membership)
│   │   ├── importExport.ts       # Netscape bookmark HTML import/export
│   │   └── captureQueue.ts       # In-process background queue for metadata+snapshot
│   ├── routes/                   # bookmarks, tags, views, preferences, import/export, snapshots
│   └── lib/url.ts                # URL normalization + duplicate-key derivation
└── tests/
    ├── unit/                     # parser, url-normalize, importExport, metadata parse
    └── integration/             # routes against temp SQLite DB

frontend/
├── src/
│   ├── main.tsx / App.tsx
│   ├── pages/                    # List, Unread, Archive, SavedView, Preferences, BookmarkDetail
│   ├── components/               # BookmarkRow, SearchBar, TagInput(+suggest), BulkBar, SortMenu, NoteEditor
│   ├── api/                      # typed client for the backend API
│   └── state/                    # selection, search, preferences
├── tests/                        # Playwright e2e (pinned 1.61.0)
└── index.html / vite.config.ts

data/                             # Runtime (gitignored): bookmarks.db, snapshots/
.harness/app.json                 # Runtime delivery descriptor (port 4000, npm start)
package.json                      # Workspace scripts: build (frontend+backend), start
```

**Structure Decision**: A single repository with a `backend/` (Fastify API +
services, serves the built SPA and the API on port 4000) and a `frontend/`
(React + Vite SPA). This "web application" layout matches the spec (a browser app
over HTTP) and keeps the search/import/capture logic server-side where the data
and FTS index live, while the SPA delivers the interactive list, search, bulk
selection, and tag autocomplete. `npm start` runs the backend which serves the
prebuilt frontend, satisfying the runtime presentation contract.

## Complexity Tracking

No constitution violations; this section intentionally left empty.
