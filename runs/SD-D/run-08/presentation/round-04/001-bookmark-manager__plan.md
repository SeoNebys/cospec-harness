# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-based bookmark manager. Users save web addresses; the
server automatically enriches each with title/description/favicon/preview and
captures a local page snapshot (PDF sources stored as PDFs), with an optional
Internet Archive save. Bookmarks support Markdown notes, tags with type-ahead
suggestions, a deliberate read-later state, sorting, multi-select and view-wide
bulk actions, non-destructive archiving with restore, saved views (search +
included/excluded tags), an advanced boolean search (fields, case-insensitive,
`#tag`, quoted phrases, AND/OR/NOT, parentheses, implicit AND), browser HTML
import/export preserving titles/tags/dates, and display preferences.

**Technical approach**: A Node.js backend (Express) exposing a JSON HTTP API and
serving a built single-page frontend on port 4000. Data lives in an embedded
SQLite database (via `better-sqlite3`) with an FTS5 full-text index for fast
search; snapshots and favicons/previews are stored as files on disk referenced by
path. Page enrichment and snapshotting reuse the image's bundled Chromium through
Playwright. A dedicated query-parser module turns the search grammar into a
combination of FTS lookups and tag joins. This keeps the whole app self-contained
(no external database or service required to run), matching the single-user,
runnable-web-app runtime conventions.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules); frontend built with the
same toolchain.

**Primary Dependencies**:
- Backend: `express` (HTTP API + static serving), `better-sqlite3` (embedded DB +
  FTS5), `playwright` (pinned `1.61.0`, Chromium enrichment + snapshot + PDF),
  `sanitize-html` + a Markdown renderer (`marked`) for safe note rendering,
  `cheerio` (parse imported bookmark HTML / fallback metadata scraping), `zod`
  (request validation).
- Frontend: `react` + `react-dom` built with `vite`; client-side routing for the
  views. Rendered output is served statically by the backend.
- Dev/test: `@playwright/test` (pinned `1.61.0`) for end-to-end, `vitest` for unit
  tests (search parser, URL normalization, import/export mapping).

**Storage**: Embedded SQLite file under a data directory (e.g. `data/app.db`); FTS5
virtual table for searchable text. Binary artifacts (snapshots, PDFs, favicons,
preview images) stored under `data/snapshots/` and referenced by relative path.

**Testing**: `vitest` for unit/contract-level logic; Playwright Test (`1.61.0`) for
integration/E2E driving Chromium. Browser binaries come from the shared
`/opt/playwright-browsers`; no second browser revision is downloaded.

**Target Platform**: Modern desktop web browser (client); Linux container (server)
listening on `0.0.0.0:4000`.

**Project Type**: Web application (backend API + frontend SPA).

**Performance Goals**: Search/filter results within 1 second for up to 5,000
bookmarks (FR/SC-004); list and bulk actions remain responsive at several thousand
bookmarks. Enrichment and snapshotting run asynchronously so saving is not blocked.

**Constraints**: Self-contained runtime (no external DB/service required to start);
Internet Archive is optional and must fail gracefully; all user- and web-derived
content rendered safely (no interface injection); HTTP-session cookies must work in
the review environment.

**Scale/Scope**: One user, personal collection sized in the low thousands of
bookmarks; 13 prioritized user stories; ~7 primary views (list, unread, archive,
bookmark detail/edit, saved views, import/export, preferences).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles, so there are no binding constitutional gates
to evaluate. In their absence this plan holds itself to the general SDD discipline
in `CLAUDE.md`:

- **Spec-derived**: every design element traces to an approved FR/user story.
- **Simplicity / YAGNI**: a single embedded datastore and one backend service; no
  speculative abstractions beyond what the stories require.
- **Testability**: pure logic (search parser, URL normalization, import mapping) is
  unit-testable in isolation; user stories are covered by E2E scenarios.
- **Self-contained runtime**: no external infrastructure required to run or review.

**Result**: PASS (no violations; Complexity Tracking not required).

*Post-Phase 1 re-check*: PASS — the design introduces no additional projects or
patterns beyond those above; all artifacts remain spec-derived.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Approved specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (HTTP API + search grammar)
│   ├── api.md
│   └── search-grammar.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (passed)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
package.json             # Root scripts: build (frontend) + start (serve on :4000)

backend/
├── src/
│   ├── server.js            # Express app; serves API + built frontend on 0.0.0.0:4000
│   ├── db/
│   │   ├── schema.sql       # Tables + FTS5 virtual table + triggers
│   │   └── index.js         # Connection, migration/bootstrap
│   ├── models/              # Data access per entity (bookmarks, tags, views, prefs)
│   ├── services/
│   │   ├── enrichment.js    # Title/description/favicon/preview via Playwright/cheerio
│   │   ├── snapshot.js      # Local page snapshot; PDF passthrough
│   │   ├── archiveOrg.js    # Internet Archive save (graceful failure)
│   │   ├── importExport.js  # Browser HTML bookmark import/export
│   │   └── search.js        # Executes parsed query against DB (FTS + tag joins)
│   ├── search/
│   │   ├── tokenizer.js     # Lexes query respecting quotes and #tag
│   │   └── parser.js        # Builds boolean AST (AND/OR/NOT, parens, implicit AND)
│   ├── url/normalize.js     # Canonicalization for duplicate detection
│   └── api/                 # Express routers grouped by resource
└── tests/
    ├── unit/                # search parser, url normalize, import mapping (vitest)
    └── e2e/                 # Playwright Test user-story scenarios

frontend/
├── src/
│   ├── main.jsx
│   ├── pages/               # List, Unread, Archive, Detail/Edit, SavedViews,
│   │                        # ImportExport, Preferences
│   ├── components/          # BookmarkCard, TagInput(+suggest), SearchBar,
│   │                        # BulkActionBar, ConfirmDialog, MarkdownNote
│   └── services/api.js      # Typed client for the backend API
├── index.html
└── vite.config.js

data/                        # Runtime data (gitignored): app.db, snapshots/
```

**Structure Decision**: Web application layout (`backend/` + `frontend/`) because
the spec requires server-side enrichment, snapshotting, and persistence behind a
rich interactive UI. The frontend is built to static assets and served by the same
Express process on port 4000, so a single `npm start` satisfies the runtime
convention and keeps deployment self-contained. `data/` holds the SQLite file and
binary snapshots and is created at runtime.

## Complexity Tracking

> No constitutional violations to justify. Section intentionally empty.
