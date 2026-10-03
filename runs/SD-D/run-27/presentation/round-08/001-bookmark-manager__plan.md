# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-based bookmark manager with automatic page-metadata
capture, strict deduplication, rich per-bookmark data (address, title,
description, formatted note, tags), an advanced boolean search, read-later,
archive, bulk actions, sorting, saved searches, standard bookmark-file
import/export, page preservation (self-contained HTML, PDFs as PDFs, optional
Internet Archive), and display preferences.

**Technical approach**: A Node.js web application. An Express HTTP server exposes
a JSON API and serves a React single-page front end (built with Vite to static
assets). Data persists in a local SQLite database (via better-sqlite3), with
full-text search backed by SQLite FTS5 and a small boolean-query parser layered
on top for `#tag`, quoted phrases, and AND/OR/NOT/parentheses. Automatic
metadata capture and self-contained-HTML page preservation reuse the
environment's bundled Playwright 1.61.0 + Chromium (single-file page capture and
PDF detection); the Internet Archive integration submits the URL to its public
"save page now" endpoint and stores the returned snapshot reference. Import/export
use the Netscape bookmark HTML format. The server listens on `0.0.0.0:4000` and
is started with `npm start`.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript/ESM) on the server; React 18 on the client.

**Primary Dependencies**:
- Server: Express (HTTP + static hosting), better-sqlite3 (storage + FTS5),
  Playwright 1.61.0 (metadata fetch + self-contained page capture, PDF detection,
  reusing `/opt/playwright-browsers`), a Netscape-bookmark HTML parser/serializer
  (lightweight, using a forgiving HTML parser such as node-html-parser),
  a note sanitizer/renderer (markdown-it + sanitize-html) applied server-side or
  a safe client renderer.
- Client: React 18 + Vite, built to static assets served by Express.

**Storage**: SQLite database file under `/work/data/` (created on first run);
preserved page files (self-contained `.html`, `.pdf`) stored under
`/work/data/preserved/` and referenced from the database.

**Testing**: Node's built-in test runner (node:test) for unit/contract tests of
the query parser, URL normalizer, import/export, and API; Playwright Test
(pinned to 1.61.0) for a small set of end-to-end UI checks.

**Target Platform**: Linux server (the shared review container); modern desktop browser client.

**Project Type**: Web application (backend API + SPA frontend), single deployable
served by one Express process.

**Performance Goals**: Search/filter results within 1 second for collections up
to 5,000 bookmarks (SC-003); bulk action over 500+ matches within 10 seconds
(SC-005); metadata-assisted save under 30 seconds typical (SC-001).

**Constraints**: Single-user, no authentication; server must listen on
`0.0.0.0:4000`; all data must persist across restart (SC-007); external
operations (metadata fetch, preservation, Internet Archive) must degrade
gracefully when the network is unavailable. A visible ready element must be
marked `data-harness-ready="true"` after initial UI + data load.

**Scale/Scope**: Personal collection targeted to thousands (design to 5,000+)
bookmarks; ~12 user stories / 37 functional requirements; roughly a dozen UI
screens/views (list, detail/edit, read-later, archive, saved searches, import/export,
preferences).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with placeholder principles and no ratified, binding rules. There are
therefore no concrete constitutional gates to enforce for this feature. The plan
nonetheless follows the project's SDD conventions in `CLAUDE.md`: spec approved
before planning (done), plan reviewed before tasks/implementation, and the
runtime-presentation rules (port 4000, `0.0.0.0`, `app.json`, readiness marker)
are incorporated in Technical Context and the structure below.

**Result**: PASS (no violations; Complexity Tracking not required).

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
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
/work
├── package.json             # scripts: start (server), build (client), test
├── server/
│   ├── index.js             # Express app entry; listens 0.0.0.0:4000; serves API + static client
│   ├── db/
│   │   ├── schema.sql       # SQLite schema (bookmarks, tags, bookmark_tags, saved_searches, preferences, preserved_copies, FTS)
│   │   └── db.js            # connection + migration bootstrap
│   ├── api/                 # route handlers per resource
│   │   ├── bookmarks.js     # CRUD, read-later, read state, archive, bulk actions
│   │   ├── tags.js          # unique-tag management + suggestions
│   │   ├── search.js        # query execution
│   │   ├── savedSearches.js
│   │   ├── importExport.js  # Netscape bookmark HTML import/export
│   │   ├── preservation.js  # local self-contained HTML / PDF + Internet Archive
│   │   └── preferences.js
│   ├── lib/
│   │   ├── urlNormalize.js  # safe-equivalence dedup rule (host case + default port only)
│   │   ├── queryParser.js   # boolean search: #tag, "phrases", AND/OR/NOT, parentheses, quoted-literal operators
│   │   ├── metadata.js      # Playwright-based title/description/icon/preview fetch
│   │   ├── capture.js       # Playwright single-file HTML capture + PDF detection
│   │   ├── archiveOrg.js    # Internet Archive submission + snapshot reference
│   │   └── netscape.js      # bookmark HTML parse/serialize (title, tags, date-added)
│   └── notes/render.js      # markdown-style note sanitize + render
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js           # fetch wrappers
│       ├── components/      # BookmarkCard, TagInput(autocomplete), SearchBar, BulkBar, etc.
│       └── views/           # ListView, DetailView, ReadLater, Archive, SavedSearches, ImportExport, Preferences
├── data/                    # runtime: sqlite db + preserved/ files (gitignored)
├── tests/
│   ├── unit/                # urlNormalize, queryParser, netscape, notes render
│   ├── contract/            # API endpoint contract tests (node:test)
│   └── e2e/                 # Playwright Test (1.61.0) smoke flows
└── .harness/app.json        # {"kind":"application","port":4000,...}
```

**Structure Decision**: Single deployable web application. One Express process
serves both the JSON API (`/api/*`) and the built React SPA (static assets),
listening on `0.0.0.0:4000`. This keeps the runtime a single `npm start` command
as required by the presentation environment, avoids a separate frontend server
and its port, and lets server-only capabilities (Playwright capture, SQLite,
file storage, Internet Archive calls) live behind the API.

## Complexity Tracking

No constitutional violations; this section is intentionally empty.
