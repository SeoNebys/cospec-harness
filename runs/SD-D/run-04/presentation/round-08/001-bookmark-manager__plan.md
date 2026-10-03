# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, desktop-first web application to save and manage bookmarks with
rich metadata, formatted notes, tags, advanced (boolean/phrase/`#tag`) search,
read-later status, reversible archiving, bulk actions, sorting, saved views,
page preservation (self-contained HTML and PDF, plus Internet Archive),
standard browser import/export, and display preferences.

**Technical approach**: A Node.js web service exposing a JSON HTTP API backed by
a local SQLite database, paired with a lightweight browser front end. Metadata
capture and self-contained HTML preservation reuse the environment's Chromium
via Playwright. Full-text and boolean search is implemented over SQLite with a
small query parser. The server listens on `0.0.0.0:4000` and is started with
`npm start`, matching the runtime presentation environment.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP API + static hosting), better-sqlite3
(embedded storage), Playwright 1.61.0 (metadata fetch + self-contained HTML
capture via shared Chromium), a minimal HTML-sanitizer for safe formatted notes,
a small hand-written boolean-search parser. Front end is plain
HTML/CSS/JavaScript (no heavy framework) served as static assets.

**Storage**: SQLite database file under `data/` (e.g., `data/bookmarks.db`);
preserved copies stored as files under `data/preserved/` referenced from the DB.

**Testing**: Node's built-in test runner (`node:test`) for unit/integration of
the search parser, normalization, import/export, and API; Playwright Test
(pinned to 1.61.0) for a small number of end-to-end UI checks.

**Target Platform**: Modern desktop web browser (Chromium-based for review);
server runs on Linux (Node.js 24) in the shared container.

**Project Type**: Web application (single deployable: API + served front end).

**Performance Goals**: Search results feel instant (< ~200 ms server time) for
collections up to 5,000 bookmarks; save-with-metadata completes within the
15-second budget of SC-001 (metadata fetch is best-effort with a timeout).

**Constraints**: Server MUST listen on `0.0.0.0:4000`; started via
`npm start`; HTTP cookies must work in the review environment **but MUST NOT
partition data** — all bookmarks, tags, saved views, and preferences form one
global single-user collection, identical across browser visits and app restarts
(no hidden per-session profiles); metadata/preservation are best-effort and must
degrade gracefully; formatted notes must be sanitized (no scripts).
Bulk "select all matching" MUST resolve the complete current view (search +
included/excluded tags + active/unread/archive view + open saved view) across
all pages (FR-025), and expose an exact affected count that equals the number of
items actually changed before destructive actions (FR-027). A bulk action invoked
from an open saved view MUST use that exact saved view's complete filters so the
count and the changed items match what the user sees (FR-025a). Bulk performance
(under 10 seconds) MUST be verified against a collection of at least 5,000
bookmarks (SC-008).
Offline-capable except for outbound metadata fetch, preservation, and Internet
Archive calls.

**Scale/Scope**: Single user; up to ~5,000 bookmarks; 14 user stories, 44
functional requirements (FR-001–042 plus FR-014a and FR-025a); ~15–25
screens/states in one front-end app.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is still the
unpopulated template — it defines no ratified principles, so there are no
specific gates to enforce. Applying the spirit of Spec-Driven Development as a
default gate:

- **Spec-first**: PASS — a reviewed, approved spec (revision 3) precedes this plan.
- **Testable requirements**: PASS — every FR maps to acceptance scenarios and
  measurable success criteria; the plan provides contracts and tests to verify them.
- **Simplicity / YAGNI**: PASS — a single deployable, one embedded database, and
  a dependency-light front end; no extra services introduced.
- **No unjustified complexity**: PASS — see Complexity Tracking (none required).

**Result**: PASS (initial). Re-checked after Phase 1 design: still PASS.

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
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
package.json             # scripts: start, test; pinned deps
server.js                # app entry: starts Express on 0.0.0.0:4000

src/
├── app.js               # Express app assembly (routes, static, session)
├── db/
│   ├── index.js         # SQLite connection + migrations
│   └── migrations/      # schema setup (bookmarks, tags, saved views, prefs)
├── models/
│   ├── bookmark.js      # bookmark persistence + queries
│   ├── tag.js           # tag persistence + suggestions
│   ├── savedView.js     # saved-view persistence
│   └── preferences.js   # display preferences
├── services/
│   ├── url.js           # address validation + normalization (FR-041)
│   ├── metadata.js      # best-effort title/description/icon/preview fetch
│   ├── search.js        # boolean/phrase/#tag query parser + evaluator
│   ├── preserve.js      # self-contained HTML, PDF download, Internet Archive
│   ├── importExport.js  # Netscape bookmark HTML import/export + merge rules
│   └── sanitize.js      # safe formatted-note sanitization
├── routes/
│   ├── bookmarks.js     # CRUD, status, archive, bulk, search, open
│   ├── tags.js          # list/suggest tags
│   ├── views.js         # saved views CRUD
│   ├── preferences.js   # get/update display preferences
│   └── ioRoutes.js      # import/export, preservation endpoints
└── public/              # front end (static, dependency-light)
    ├── index.html       # single-page shell; marks data-harness-ready
    ├── css/styles.css
    └── js/              # list, editor, search box, bulk bar, views, settings

data/                    # created at runtime (gitignored)
├── bookmarks.db
└── preserved/           # self-contained HTML + downloaded PDFs

tests/
├── unit/                # url normalization, search parser, sanitizer, merge
├── integration/         # API routes against a temp SQLite db
└── e2e/                 # Playwright: save→find→open, archive, bulk
```

**Structure Decision**: Single web-application project (API + served static
front end in one deployable). This satisfies the runtime requirement of one
`npm start` server on `0.0.0.0:4000`, keeps the single-user app simple, and
avoids the overhead of separate frontend/backend deployables. Business logic
lives in `src/services` (pure, unit-testable); `src/routes` are thin HTTP
adapters; `src/models` isolate SQLite access.

## Complexity Tracking

No constitution violations; no complexity deviations require justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | —          | —                                   |
