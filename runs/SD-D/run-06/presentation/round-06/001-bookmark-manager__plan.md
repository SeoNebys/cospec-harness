# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-accessed web application for saving and managing a growing
bookmark collection with locally-stored data. Users save an address; the app
auto-collects title/description/site-icon/preview-image, prevents duplicates
(routing repeat saves to the existing bookmark), and supports tags with
suggestions and filtering, an expressive search (case-insensitive; phrases,
`#tag`, AND/OR/NOT, grouping, implicit-AND, quoted operators-as-text), a
read-later workflow, reversible archiving, sorting, multi-select bulk actions,
saved views, formatted notes, local page preservation (self-contained HTML for
pages, original PDF for PDFs) with optional Internet Archive submission,
standard browser-bookmark import/export, and personal display preferences.

**Technical approach**: A Node.js web app — an Express HTTP server exposing a
JSON API and serving a lightweight browser client — backed by a local SQLite
database (via `better-sqlite3`) plus a files directory for preserved copies.
Metadata capture and self-contained HTML snapshots use the pre-installed
Playwright 1.61.0 + Chromium; PDF links are streamed to disk unchanged. Search
is a small hand-written parser producing an AST evaluated against SQLite. All
external steps (metadata fetch, snapshot, Internet Archive) are best-effort and
non-blocking so saving never fails on them.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules) — matches the shared image.

**Primary Dependencies**:
- `express` — HTTP server, JSON API, static client hosting (listens on `0.0.0.0:4000`).
- `better-sqlite3` — embedded, file-based relational storage (synchronous, fast).
- `playwright` (pinned `1.61.0`) + shared Chromium — page metadata extraction and
  self-contained HTML snapshotting; browser binaries from `/opt/playwright-browsers`.
- `cheerio` — HTML parsing for the Netscape bookmark import/export and metadata fallback.
- `markdown-it` + `sanitize-html` — author and safely render formatted notes.
- Client: framework-free vanilla JS/HTML/CSS (no build step) served from `src/web/`.

**Storage**: Local SQLite database file plus a preserved-copies directory, both
under a single app data directory (`data/`). Bookmarks, tags, saved views, and
display preferences live in SQLite; preserved HTML/PDF blobs live on disk with
paths referenced from the database.

**Testing**: `node:test` (built-in runner) for unit/integration of the search
parser, address normalization, import/export, and API routes; `@playwright/test`
(pinned `1.61.0`) for a small end-to-end smoke of the primary flows.

**Target Platform**: Linux container on the shared Docker network; served at
`http://maker:4000` for the client, captured via `http://127.0.0.1:4000`.

**Project Type**: Web application — single project, Express backend serving a
static browser client (no separate frontend build).

**Performance Goals**: Browsing, sorting, filtering, and search results update in
under 1 second with at least 1,000 bookmarks (SC-004); metadata capture runs
asynchronously and does not block the save response (SC-001).

**Constraints**: Offline-capable local persistence; single writer (one user);
preservation and Internet Archive steps are asynchronous and non-blocking
(FR-029); HTTP-session-friendly (though v1 has no login) and must bind `0.0.0.0`
per the runtime environment.

**Scale/Scope**: One user; low thousands of bookmarks; 11 user stories / 35+2
functional requirements; ~10–15 API endpoints; a handful of client views
(all / unread / archive / saved views / preferences).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is the unpopulated
template — it contains only placeholders and defines **no ratified principles or
constraints**. There are therefore no project-specific gates to evaluate.

Applying the template's default spirit (simplicity, testability, no unjustified
complexity) as informal guidance:

- **Single project, minimal dependencies**: PASS — one Express project, a
  file-based DB, no microservices, no client build pipeline.
- **Testability**: PASS — pure logic (search parser, normalization, import/export)
  is unit-tested; API and flows are integration/e2e tested.
- **No premature complexity**: PASS — no auth/sync/multi-user machinery (all
  explicitly out of scope in the spec's Assumptions).

**Result**: Gate passes (no constitution violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Approved specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (HTTP API contract)
│   └── api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── index.js             # App entry: builds app, listens on 0.0.0.0:4000
│   ├── app.js               # Express app wiring (routes, static, error handling)
│   ├── db/
│   │   ├── connection.js     # better-sqlite3 handle + pragmas
│   │   └── migrations.js     # Schema creation / versioning
│   ├── routes/
│   │   ├── bookmarks.js       # CRUD, save-or-route-to-existing, bulk actions
│   │   ├── tags.js            # list/suggest tags
│   │   ├── search.js          # query endpoint (uses search parser)
│   │   ├── views.js           # saved views CRUD
│   │   ├── preservation.js    # trigger/status of local copy + Internet Archive
│   │   ├── importexport.js    # Netscape bookmark import/export
│   │   └── preferences.js     # display preferences
│   ├── services/
│   │   ├── metadata.js        # title/description/icon/preview via Playwright
│   │   ├── preserve.js        # self-contained HTML snapshot; original PDF store
│   │   ├── archiveOrg.js      # Internet Archive submission (best-effort)
│   │   ├── search/
│   │   │   ├── tokenize.js     # lexer (quotes, #tag, parens, operators)
│   │   │   ├── parse.js        # AST (implicit AND, precedence, quoted-literal ops)
│   │   │   └── toSql.js        # AST → SQLite WHERE + params
│   │   ├── normalizeUrl.js    # scheme/trailing-slash/host-case normalization
│   │   ├── duplicates.js      # existing-bookmark lookup by normalized address
│   │   ├── bookmarksImport.js # parse Netscape HTML (titles, tags, dates)
│   │   └── bookmarksExport.js # emit Netscape HTML
│   └── lib/notes.js          # markdown-it render + sanitize-html
├── web/                      # Framework-free client (served statically)
│   ├── index.html
│   ├── app.js                # views: all / unread / archive / saved views / prefs
│   ├── search.js             # query box, tag suggest, filters, sort, bulk select
│   └── styles.css            # honors text-size preference
data/                         # Created at runtime (gitignored)
├── bookmarks.db              # SQLite database
└── preserved/                # <bookmarkId>.html or <bookmarkId>.pdf snapshots
tests/
├── unit/                     # search parser, normalizeUrl, notes, import/export
├── integration/              # API routes against a temp SQLite db
└── e2e/                      # Playwright smoke of primary flows
package.json                  # "start": node src/server/index.js
```

**Structure Decision**: Single web-application project. The Express server both
exposes the JSON API and serves the static `src/web/` client, so there is no
separate frontend build or deployment. Local state lives entirely under `data/`
(SQLite DB + preserved files), satisfying the single-user, local-persistence
assumptions. `src/server/services/` isolates the externally-dependent,
best-effort work (metadata, preservation, Internet Archive) from request
handling so those steps can run asynchronously without blocking saves.

## Complexity Tracking

> No constitution violations. This section is intentionally empty.
