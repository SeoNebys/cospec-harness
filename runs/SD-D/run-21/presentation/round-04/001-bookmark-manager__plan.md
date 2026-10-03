# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application for saving and managing bookmarks. When a URL is
entered, the app fetches page metadata (title, description, site icon, preview
image) for review and editing, then stores the bookmark durably. Users browse,
sort, and search their collection with a case-insensitive boolean query language
(`#tag`, quoted phrases, AND/OR/NOT/parentheses; precedence NOT→AND→OR), organize
with tags (autocompleted) and reusable saved views, and move bookmarks between
active / read-later / archived states. Bulk actions apply to multi-selections or
whole filtered result sets. Bookmarks import from and export to the standard
Netscape bookmark-file format (source folders → tags). Optional page
preservation stores a self-contained HTML capture (PDFs kept as PDFs) and can
request an Internet Archive snapshot. Notes support simple rich text; display
preferences (default sort, information density, text size) persist.

**Technical approach**: A Node.js web service (Express) exposes a REST API and
serves a React single-page frontend. Data persists in a local SQLite database;
page captures and PDFs are stored as files on disk referenced from the database.
Server-side page fetching handles metadata extraction and self-contained HTML
capture via the already-installed Chromium/Playwright. The boolean search query
is parsed into an expression tree and evaluated against an indexed candidate set.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules); React 18 for the
frontend.

**Primary Dependencies**:
- Backend: Express (HTTP/API), better-sqlite3 (embedded storage), cheerio
  (HTML metadata parsing), Playwright 1.61.0 (headless Chromium for
  self-contained HTML capture — reuses the image's shared browser binaries).
- Frontend: React 18 + Vite (build), built to static assets served by Express.
- Rich-text notes: a lightweight editor storing sanitized HTML (e.g. a small
  contenteditable-based editor); server sanitizes on save.

**Storage**: SQLite database file at `data/bookmarks.db`. Captured page copies
and PDFs stored under `data/captures/` and referenced by path from the database.

**Testing**: Vitest for unit tests (search-query parser/evaluator, bookmark
import/export mapping, metadata extraction). Playwright Test (Node), pinned to
1.61.0, for end-to-end flows against the running app.

**Target Platform**: Linux container; served over HTTP on `0.0.0.0:4000`.
Accessed via a modern desktop/mobile browser with JavaScript enabled.

**Project Type**: Web application (React frontend + Express backend in one
repository).

**Performance Goals**: Search/sort/filter results update within 1 second for a
collection of at least 500 bookmarks (SC-003). List and bulk selection remain
responsive with many hundreds of bookmarks.

**Constraints**: Single user, no authentication (v1). External page fetching,
metadata capture, HTML/PDF preservation, and Internet Archive snapshots are
best-effort and must fail gracefully without harming the bookmark. Self-contained
HTML captures embed needed assets; PDFs preserved as PDFs. HTTP server binds
`0.0.0.0`, port 4000, per the runtime presentation environment.

**Scale/Scope**: One user's personal collection targeting 500+ bookmarks (tested
to that scale). 11 prioritized user stories, ~29 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is an unpopulated
template (placeholder principles only); it defines no ratified, enforceable
gates. There are therefore no constitution constraints to violate. Guiding
practices adopted voluntarily for this plan: keep a single project (no premature
service split), test the risky logic first (search parser, import/export), and
prefer standard formats and best-effort degradation over bespoke complexity.

**Result**: PASS (no gates defined). Re-checked after Phase 1 — still PASS; no
complexity deviations to record.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── spec.md              # Approved specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST API contract)
│   └── api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
server/
├── index.js                 # Express app bootstrap, static serving, 0.0.0.0:4000
├── db/
│   ├── connection.js        # better-sqlite3 handle + pragmas
│   └── migrations.js        # schema creation/upgrade
├── routes/
│   ├── bookmarks.js         # CRUD, state changes, bulk actions
│   ├── search.js            # query endpoint (delegates to search module)
│   ├── tags.js              # tag list + suggestions
│   ├── views.js             # saved views CRUD
│   ├── captures.js          # local HTML/PDF capture + serve, IA snapshot
│   ├── importexport.js      # Netscape bookmark import/export
│   └── preferences.js       # display preferences
├── services/
│   ├── metadata.js          # fetch + extract title/description/icon/preview
│   ├── capture.js           # self-contained HTML (Playwright) + PDF storage
│   ├── archiveorg.js        # Internet Archive save request
│   ├── search/
│   │   ├── tokenizer.js     # tokens: terms, #tag, "phrases", AND/OR/NOT, ()
│   │   ├── parser.js        # tokens → expression tree (NOT→AND→OR, parens)
│   │   └── evaluate.js      # expression tree → matching bookmarks
│   ├── netscape.js          # parse/generate bookmark HTML (folders↔tags)
│   └── sanitizeNote.js      # sanitize rich-text note HTML
└── models/                  # data access helpers per entity

web/
├── index.html               # SPA shell; sets data-harness-ready when loaded
├── vite.config.js           # pinned; builds to server-served static dir
└── src/
    ├── main.jsx
    ├── api.js               # REST client
    ├── pages/               # Active / Read-later / Archive / Saved view
    ├── components/          # List, BookmarkCard, SaveForm, TagInput,
    │                        #   SearchBar, BulkBar, SavedViews, Preferences,
    │                        #   NoteEditor, CaptureControls, ImportExport
    └── state/               # client state (selection, filters, prefs)

tests/
├── unit/                    # search parser/evaluator, netscape, metadata (Vitest)
└── e2e/                     # Playwright Test flows per user story

data/                        # runtime: bookmarks.db, captures/ (gitignored)
package.json                 # scripts: build (vite), start (node server), test
```

**Structure Decision**: Single web-application project. One `package.json` at the
root drives both the Express backend (`server/`) and the Vite-built React
frontend (`web/`). `npm run build` produces static frontend assets that Express
serves; `npm start` launches the server on `0.0.0.0:4000` as the sole foreground
process declared to the runtime harness. This keeps deployment to one command
and one process while separating API and UI concerns in source.

## Complexity Tracking

No constitution gates are defined, and the plan introduces no violations
requiring justification. This section is intentionally empty.
