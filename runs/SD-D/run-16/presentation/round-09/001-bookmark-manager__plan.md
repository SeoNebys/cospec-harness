# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A personal, single-user web application to save and manage bookmarks. Users save a
web address and the app captures its title, description, icon, and preview image;
users browse an easy-to-read list, run a flexible search (phrases, `#tag`,
AND/OR/NOT with parentheses, implicit AND, quoted literal operators), organize with
tags (with autocomplete), track read-later state, archive/restore, act on many
bookmarks at once, sort and set display preferences, save reusable searches,
import/export in the browser bookmark file format, write Markdown notes, and preserve
pages (a single self-contained HTML file, PDFs kept as PDFs, plus an Internet Archive
snapshot link).

**Technical approach** (from research): a single Node.js app — Express JSON REST API +
a no-build vanilla-JS single-page frontend — backed by SQLite (`better-sqlite3`) with
preserved files on disk. Page metadata via `cheerio`; offline preservation via
`single-file-cli` driving the shared Chromium; Internet Archive via Save Page Now;
Markdown via `marked` + sanitizer; a hand-written search-query parser evaluated in the
service layer. Served on `0.0.0.0:4000` via `npm start`.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express 4 (HTTP + static), better-sqlite3 (storage), cheerio
(HTML metadata parse + bookmark-file import/export), single-file-cli (self-contained
HTML preservation, using the shared Chromium), marked + DOMPurify/jsdom (Markdown
render + sanitize). Dev: node:test, supertest, playwright@1.61.0.

**Storage**: SQLite database file under `data/`; preserved page copies and PDFs as
files under `data/preserved/`.

**Testing**: node:test + supertest for unit/integration; playwright@1.61.0 for a small
set of end-to-end UI checks (shared Chromium at `/opt/playwright-browsers`).

**Target Platform**: Linux container; modern browser client. Server binds
`0.0.0.0:4000` (final application) per the runtime presentation environment.

**Project Type**: Web application (single deployable Node app serving API + static UI).

**Performance Goals**: Search/filter/sort results within 1s for 500+ bookmarks
(SC-003); first save with metadata under 30s (SC-001); bulk action across 100+
selected bookmarks in one operation (SC-005).

**Constraints**: Single user, no authentication. Zero data loss across restarts
(SC-004). Preservation reuses the shared Chromium — no second browser download.
External features (metadata capture, offline preservation, Internet Archive) degrade
gracefully with clear messaging when the network/target is unreachable (FR-037).

**Scale/Scope**: One user; personal-scale collection (hundreds to a few thousand
bookmarks). 12 prioritized user stories, 39 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified
template with placeholder principles and no concrete governance rules. There are
therefore **no enforceable constitution gates** to evaluate for this feature.

- **Initial check (pre-Phase 0)**: PASS (no applicable principles).
- **Post-design re-check (post-Phase 1)**: PASS (no applicable principles; design adds
  no complexity requiring justification).

No entries required in Complexity Tracking.

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
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── index.js            # App entry: create server, bind 0.0.0.0:4000, npm start
│   ├── app.js              # Express app wiring (routes, static, JSON, errors)
│   ├── db/
│   │   ├── connection.js   # better-sqlite3 setup, data/ dir bootstrap
│   │   └── migrations.js   # Schema creation/migration
│   ├── routes/
│   │   ├── bookmarks.js     # CRUD, dedup-open, open, bulk actions
│   │   ├── search.js        # Search endpoint (uses query parser)
│   │   ├── tags.js          # Tag list + suggestions
│   │   ├── savedSearches.js # Saved search CRUD + run
│   │   ├── preferences.js   # Display preferences
│   │   ├── preservation.js  # Offline copy + Internet Archive
│   │   └── importExport.js  # Import/export browser bookmark file
│   ├── services/
│   │   ├── bookmarks.js      # Bookmark domain logic (states, dedup, timestamps)
│   │   ├── searchParser.js   # Tokenizer + recursive-descent parser → AST
│   │   ├── searchEvaluator.js# AST evaluation over records
│   │   ├── metadata.js       # Fetch + parse title/description/icon/preview
│   │   ├── preservation.js   # single-file-cli + PDF capture + Internet Archive
│   │   ├── importExport.js   # Netscape bookmark HTML parse/generate
│   │   └── markdown.js       # Markdown render + sanitize
│   └── config.js            # Ports, paths, timeouts
└── web/
    ├── index.html           # SPA shell; sets data-harness-ready when loaded
    ├── styles.css
    └── app.js               # Views, list, search box, bulk select, tag input, prefs

data/                        # Runtime data (gitignored): sqlite db + preserved/
tests/
├── unit/                    # searchParser, importExport, metadata, markdown
├── integration/             # API routes via supertest
└── e2e/                     # playwright@1.61.0 smoke checks

package.json                 # "start": node src/server/index.js
.harness/app.json            # Runtime descriptor (kind: application, port 4000)
```

**Structure Decision**: A single Node web application (Project Type: web). Backend
lives under `src/server` (Express API + services + SQLite), the client under `src/web`
(no-build static SPA). This avoids a separate frontend build/deploy while keeping a
clean API boundary that the acceptance scenarios can test via HTTP. Runtime artifacts
live under `data/`; the harness descriptor at `.harness/app.json` starts the app with
`npm start` on port 4000.

## Complexity Tracking

No constitution violations; no entries required.
