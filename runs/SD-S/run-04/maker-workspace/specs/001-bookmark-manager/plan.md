# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user app to capture, find, organize, and maintain web bookmarks. The
defining behaviour is effortless capture: the user pastes a link and the app
automatically fetches the page's title and a short preview (description + optional
thumbnail). Retrieval is served by a newest-first list, full-text search, and tag
filtering. Editing and confirmed deletion keep the collection accurate.

**Technical approach**: A local web application with a thin backend. The backend
exists for two reasons the browser cannot satisfy alone: (1) fetching metadata
from arbitrary third-party pages, which browser same-origin/CORS rules block, and
(2) durable local persistence with fast search. Metadata fetching is decoupled
from saving — a bookmark is saved immediately and enriched asynchronously — so
that a slow or failed fetch never blocks the user (FR-016, FR-017, SC-007).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (backend and frontend share one language)

**Primary Dependencies**: Fastify (HTTP API), better-sqlite3 (storage), Cheerio + Open Graph parsing (metadata extraction), React 18 + Vite (frontend)

**Storage**: SQLite (single file on disk), with FTS5 full-text index for search

**Testing**: Vitest (unit + integration), Playwright (end-to-end user scenarios)

**Target Platform**: Modern web browsers, run locally (e.g. `localhost`) as a personal single-user app

**Project Type**: Web application (frontend + backend)

**Performance Goals**: Search results < 1s at 1,000 bookmarks (SC-003); save action completes < 5s regardless of fetch outcome (SC-007)

**Constraints**: Saving MUST NOT block on metadata fetch (async enrichment); metadata fetch bounded by a timeout with graceful fallback; app usable offline for browsing/searching already-saved bookmarks

**Scale/Scope**: One user, on the order of thousands of bookmarks; ~5 primary screens/views (list, add, detail/edit, tag filter, search results)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no concrete gates to enforce.
General good practice is followed regardless: keep the design as simple as the
requirements allow, and add complexity only when a requirement demands it.

**Result**: PASS (no defined constraints violated). Re-checked after Phase 1: still PASS — see Complexity Tracking (none required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (HTTP API contract)
│   └── api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Bookmark, Tag types and DB row mappers
│   ├── services/        # bookmarkService, tagService, metadataFetcher, search
│   ├── api/             # Fastify routes for bookmarks, tags, search
│   ├── db/              # SQLite connection, schema/migrations, FTS setup
│   └── server.ts        # App entry point
└── tests/
    ├── unit/            # service + validation unit tests
    ├── integration/     # API route + DB integration tests
    └── contract/        # API contract tests

frontend/
├── src/
│   ├── components/      # BookmarkCard, TagFilter, SearchBar, AddBookmarkForm, ...
│   ├── pages/           # Collection view, bookmark detail/edit
│   ├── services/        # API client
│   └── main.tsx         # App entry point
└── tests/
    ├── unit/            # component/logic tests
    └── e2e/             # Playwright end-to-end scenarios
```

**Structure Decision**: Web application with separate `backend/` and `frontend/`
directories. The split is driven by a hard requirement, not preference: metadata
fetching from arbitrary URLs (FR-014) cannot run in the browser due to CORS, and
durable local persistence with fast search (FR-004, SC-003) is a server-side
concern. Both sides use TypeScript to keep the surface small.

## Complexity Tracking

No constitution violations and no unjustified complexity. The two-part
(frontend/backend) structure is required by FR-014's cross-origin metadata fetch
and is the simplest arrangement that satisfies it; a single browser-only app
cannot meet that requirement.
