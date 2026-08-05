# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, local bookmark manager that lets a person save web pages (with
best-effort auto-fetched previews: description, site icon, preview image), open
them, find them via text/phrase/boolean-tag search, organize them with tags,
read-later flags, archiving, bulk actions, and reusable saved searches, with
rich-text notes — all persisted locally on the person's own device.

**Technical approach**: A **local web application** — a small backend process the
person runs on their machine, opened in their browser at `localhost`. The backend
owns local persistence (an embedded on-disk database) and performs page-metadata
fetching server-side (which also sidesteps browser cross-origin limits). The
frontend is a single-page app. Everything runs offline except the best-effort
metadata fetch, which reaches out to the page being saved.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (both backend and frontend)

**Primary Dependencies**:
- Backend: Fastify (HTTP server), better-sqlite3 (embedded DB access), a lightweight
  HTML metadata parser for Open Graph / Twitter Card / `<meta>` / favicon extraction,
  a Markdown renderer + HTML sanitizer for notes.
- Frontend: React 18 + Vite, a small client-side router, a constrained Markdown
  editor for notes.

**Storage**: SQLite database file on the local disk (single-user, single-device).
Full-text search via SQLite FTS5; tag boolean logic via SQL joins.

**Testing**: Vitest (unit + integration, including an in-memory SQLite DB for
backend tests); Playwright for end-to-end acceptance flows mapped to the spec's
user stories.

**Target Platform**: Desktop (macOS/Windows/Linux) — runs locally, used in a
modern browser. No server deployment, no accounts.

**Project Type**: Local web application (backend service + SPA frontend, one repo).

**Performance Goals**: Search/filter results feel instant (<100 ms) for collections
up to ~500 bookmarks (SC-002/SC-005); comfortably handles a few thousand. Saving
returns in well under the 20 s budget (SC-001) by never blocking on metadata fetch.

**Constraints**: Offline-capable except metadata fetch; metadata fetch is
best-effort with a short timeout and MUST NOT block or fail a save (FR-005);
confirmed saves are never lost (SC-004); zero duplicate entries for the same
normalized address (SC-007).

**Scale/Scope**: One user, one device, up to a few thousand bookmarks; ~6–8
screens/views (main list, editor, read-later, archived, saved-search bar, batch
selection mode).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template — it contains only placeholders and defines no ratified principles.
There are therefore **no binding constitutional gates** to evaluate against.

In the absence of ratified principles, this plan applies conservative defaults
consistent with the SDD method in `CLAUDE.md`:

- **Spec is the source of truth** — every design element traces to a numbered
  requirement (FR-xxx) or success criterion (SC-xxx); nothing is invented beyond
  the approved spec.
- **Simplicity / YAGNI** — one embedded database, no external services, no
  auth/accounts/sync (all explicitly out of scope per the approved Assumptions).
- **Testability** — each user story is independently testable; acceptance
  scenarios map to automated tests.

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST API + filter model)
│   ├── rest-api.md
│   └── filter-model.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── shared/               # Types shared by server + web
│   └── types.ts          # Bookmark, Tag, SavedSearch, TagFilter, SortOrder, View
├── server/
│   ├── index.ts          # Fastify app bootstrap, serves API + built SPA
│   ├── db/
│   │   ├── schema.sql     # Tables, FTS5 virtual table, triggers, indexes
│   │   ├── connection.ts  # Open/init SQLite file, run migrations
│   │   └── queries.ts     # Prepared statements (CRUD, search, batch)
│   ├── routes/
│   │   ├── bookmarks.ts    # CRUD, batch, list-with-filter
│   │   ├── tags.ts         # Distinct tags + counts (suggestions/filter)
│   │   └── savedSearches.ts
│   ├── services/
│   │   ├── url.ts          # Normalize + validate + duplicate-key derivation
│   │   ├── metadata.ts     # Best-effort fetch/parse (OG/Twitter/meta/favicon)
│   │   ├── enrichment.ts   # Background enrichment queue + timeout handling
│   │   ├── search.ts       # Build FTS + tag-boolean queries from a TagFilter
│   │   ├── notes.ts        # Markdown → sanitized HTML (allowlist)
│   │   └── backup.ts       # Export whole collection to / import from portable JSON (FR-026..FR-030)
│   └── lib/
└── web/
    ├── main.tsx
    ├── api/client.ts        # Typed fetch wrapper over the REST contract
    ├── pages/
    │   ├── ListPage.tsx     # Main list + search bar + sort + views
    │   ├── ArchivedPage.tsx
    │   └── ReadLaterPage.tsx
    └── components/
        ├── BookmarkCard.tsx     # Title, address, description, icon, preview image
        ├── BookmarkEditor.tsx   # Add/edit: url, title, description, notes, tags
        ├── SearchBar.tsx        # Text + quoted-phrase + tag any/all/not builder
        ├── TagInput.tsx         # Tag entry with suggestions from used tags
        ├── NotesEditor.tsx      # Constrained rich-text (headings, bullets, links)
        ├── BatchToolbar.tsx     # Selection + select-all-showing + batch actions
        ├── SavedSearchBar.tsx   # Save / apply / rename / remove saved searches
        ├── BackupPanel.tsx      # Export / import collection (FR-026..FR-030)
        └── EmptyState.tsx       # Empty + no-results states per view

tests/
├── unit/          # url normalize, notes sanitize, search-query builder, metadata parse
├── integration/   # route-level tests: CRUD, batch, filter, dupe, export→import round-trip (in-memory SQLite)
└── e2e/           # Playwright flows, one per user story (US1–US6)
```

**Structure Decision**: Single repository, one local web application split into
`src/server` (Fastify + SQLite + metadata fetch) and `src/web` (React SPA), sharing
types via `src/shared`. This split is required because two capabilities cannot live
purely in the browser: (a) reaching arbitrary third-party pages to fetch preview
metadata without cross-origin blocking, and (b) durable local persistence with
fast full-text + boolean-tag search. The backend runs as the local app process and
also serves the built SPA, so the person launches one thing.

**Tracked roadmap note — double-click desktop app**: v1 ships as "launch the local
backend, open in browser." The client prefers a true double-click desktop app and
accepted starting simpler on the understanding it is an easy, non-boxing-in
follow-up. The chosen architecture keeps this cheap: wrapping the same backend +
SPA in **Tauri** (or Electron) yields a double-click app **without changing the core
code** — the storage, API, search, and enrichment services are reused as-is. This is
recorded here so it is not lost; it is a deliberate fast-follow, not dropped scope.

**Export/import (FR-026..FR-030)**: The portable file is an open, documented **JSON**
document (human-readable, satisfies FR-027). Export serializes the whole collection;
import validates the file, then applies it inside a **single database transaction** so
a bad file leaves the collection untouched (FR-030), merging by normalized `url_key`
(FR-029). Handled by `services/backup.ts` and the endpoints in `contracts/rest-api.md`.

## Complexity Tracking

> No constitutional violations. Section intentionally empty.
