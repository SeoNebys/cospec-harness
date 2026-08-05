# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, personal, browser-based web app for saving and managing web-page
bookmarks. The user saves links (with auto-derived titles), browses and reopens
them, organizes them with tags, searches/filters, and edits or deletes them
(with confirmation and undo). Data persists across sessions and stays responsive
with thousands of bookmarks.

Technical approach: a small full-stack web app. A lightweight backend exposes a
REST API and owns persistence in a file-based SQLite database; it also performs
server-side title derivation by fetching the target page (avoiding browser
cross-origin restrictions). A single-page frontend provides the list, save/edit
forms, search, and tag filtering. Because the app is single-user and personal,
there is no authentication, no accounts, and no sharing.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (backend and frontend)

**Primary Dependencies**:
- Backend: Fastify (HTTP + routing), better-sqlite3 (embedded DB), zod (validation), a lightweight HTML title parser (e.g. node-html-parser) for fetched pages
- Frontend: React 18 + Vite (SPA), a small client-side fetch wrapper (no heavyweight state library — React state + a query cache is sufficient)

**Storage**: SQLite (single local file, e.g. `data/bookmarks.db`). Zero-config, file-based, and comfortably handles thousands of rows — a good fit for a single-user personal app.

**Testing**: Vitest (backend + frontend unit), Supertest against Fastify (API contract/integration), Playwright (end-to-end user journeys P1–P2 at minimum)

**Target Platform**: Modern evergreen desktop browser; backend runs locally (Node process) on the user's machine or a personal host

**Project Type**: Web application (frontend SPA + backend API)

**Performance Goals**: Search/filter results feel instant (<200ms perceived) over a collection of 2,000+ bookmarks; initial list render responsive at that scale

**Constraints**: Single-user, no auth; runs locally with no external service dependency except an outbound fetch to derive page titles (best-effort, degrades gracefully); data must survive restarts with zero loss under normal use

**Scale/Scope**: One user; target 2,000+ bookmarks without degradation; ~4 primary screens/flows (list, save, edit, search/filter)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no explicit gates to satisfy.
Applying the template's implied spirit (simplicity / YAGNI):

- **Simplicity**: Single backend + single frontend, one file-based DB, no auth,
  no accounts, no premature abstractions. PASS.
- **No unjustified complexity**: No message queues, no external services beyond a
  best-effort title fetch, no microservices. PASS.

No violations to record in Complexity Tracking.

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
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Bookmark, Tag types + zod schemas
│   ├── db/              # SQLite connection, schema/migrations, queries
│   ├── services/        # bookmark service (CRUD, dedupe), title-fetch service
│   ├── routes/          # Fastify route handlers implementing the REST contract
│   └── server.ts        # App bootstrap
└── tests/
    ├── contract/        # API contract tests (Supertest)
    ├── integration/     # service + DB integration
    └── unit/            # validation, title parsing, dedupe logic

frontend/
├── src/
│   ├── components/      # BookmarkList, BookmarkForm, TagFilter, SearchBar, EmptyState, UndoToast
│   ├── pages/          # Main app view
│   ├── api/            # typed client for the REST contract
│   └── main.tsx        # SPA entry
└── tests/
    ├── unit/           # component/logic tests (Vitest)
    └── e2e/            # Playwright user-journey tests
```

**Structure Decision**: Web application layout (Option 2) — a `backend/` API
service plus a `frontend/` SPA. This cleanly separates persistence and the
server-side title fetch (which must live off the browser to avoid cross-origin
blocking) from the user interface, while staying small and single-purpose.

## Complexity Tracking

No constitution violations — section intentionally empty.
