# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-based bookmark manager. The user saves web addresses; the
app automatically captures page metadata (title, description, favicon, preview
image) and attempts an offline copy of the page on save, still saving with an
"offline copy unavailable" indicator when capture fails. Users browse a rich list
(title, description, tags, favicon), run advanced searches (case-insensitive over
title/description/notes/address, exact phrases, `#tag`, and `AND`/`OR`/`NOT` with
parentheses — quoting an operator word makes it literal), sort, use a read-later
unread view, bulk-act on selections or all-matching, archive reversibly, keep
formatted notes, define saved filters, import/export the browser HTML format, and
set display preferences.

**Technical approach**: A Node.js web service (Express) exposes a REST/JSON API
and serves a single-page frontend. Data persists in an embedded SQLite database
via `better-sqlite3`; captured snapshots and PDFs are stored as files on disk.
Metadata is fetched server-side and parsed for standard `<title>`, meta
description, favicon, and Open Graph `og:image`. Offline copies are produced with
the pre-installed Playwright Chromium (single-file MHTML snapshot via CDP);
PDF targets are stored verbatim. Optional Internet Archive preservation calls the
public "Save Page Now" endpoint. Search is a small hand-written parser producing
a boolean expression tree evaluated against bookmark fields.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules) — the image's primary
runtime.

**Primary Dependencies**:
- `express` — HTTP server, REST API, static file serving (listens on `0.0.0.0`).
- `better-sqlite3` — synchronous embedded SQLite storage (single-user, no
  external DB service needed).
- `playwright` (pinned `1.61.0`) — drives the pre-installed Chromium to render
  pages and capture single-file offline snapshots (MHTML); browser binaries at
  `/opt/playwright-browsers`.
- `node-html-parser` (or `cheerio`) — parse fetched HTML for metadata.
- `dompurify` + `jsdom` — server-side sanitization of rich notes (stored as safe
  HTML); frontend renders the sanitized HTML.
- Frontend: vanilla JavaScript + HTML + CSS (no build step) to keep tooling and
  the lockfile minimal. A lightweight rich-text notes editor uses `contenteditable`
  with a small formatting toolbar producing sanitized HTML.

**Storage**:
- SQLite database file at `data/bookmarks.db`.
- Offline snapshots and PDFs under `data/snapshots/` (one file per bookmark,
  referenced by bookmark id).

**Testing**:
- `node:test` (built-in) for unit tests — especially the search query parser and
  the Netscape import/export round-trip.
- `@playwright/test` pinned `1.61.0` for end-to-end UI tests against the running
  app.

**Target Platform**: Linux server (container) serving a browser-based UI on port
`4000` (final application) per the project runtime environment.

**Project Type**: Web application (single deployable: Node backend + served
static frontend).

**Performance Goals**: List, search, sort, and bulk actions feel responsive
(<~1s) with 500+ bookmarks (SC-006). Bulk action over 50 items <15s (SC-004).
Metadata fetch and offline capture run on save and may take longer; they must not
block the saved record from persisting.

**Constraints**:
- Server must listen on `0.0.0.0:4000`; `npm start` from `/work` starts the
  prepared app. `data-harness-ready="true"` set once initial UI + data load.
- External retrieval (metadata, offline capture, Internet Archive) is best-effort
  and must degrade gracefully; failures never block saving.
- HTTP-session cookies must work in the review environment (not applicable for
  auth since single-user/no-login, but any session use must be review-compatible).

**Scale/Scope**: Single user; thousands of bookmarks; ~1 primary screen with
list, detail/edit, archive view, unread view, saved filters, preferences.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is an unpopulated
template (placeholder principles only). There are therefore **no ratified,
enforceable gates** to check against. No principle is violated by this plan.

**Advisory defaults adopted** (in the spirit of a minimal constitution):
- Prefer the simplest structure that satisfies the spec (single deployable, no
  microservices, embedded DB).
- Test the risk-bearing logic (search parser, import/export) and provide e2e
  coverage of the primary flows.
- Keep external, flaky dependencies (capture, Internet Archive) isolated behind
  small service modules with graceful fallbacks.

**Result**: PASS (no gates defined; no violations). Re-checked after Phase 1
design — still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── rest-api.md      # HTTP endpoints (requests/responses)
│   └── search-query-grammar.md  # Search language grammar + semantics
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
/work
├── package.json                 # scripts: "start" -> node server/index.js
├── package-lock.json            # preserved lockfile
├── server/
│   ├── index.js                 # Express app; listens 0.0.0.0:4000; static + API
│   ├── db.js                    # better-sqlite3 connection + schema migration
│   ├── routes/
│   │   ├── bookmarks.js         # CRUD, list/search/sort, read state, archive, bulk
│   │   ├── tags.js              # tag list + suggestions
│   │   ├── filters.js           # saved filters CRUD
│   │   ├── preferences.js       # display preferences
│   │   ├── preservation.js      # offline copy status, Internet Archive trigger
│   │   └── porting.js           # import/export (Netscape HTML)
│   └── services/
│       ├── metadata.js          # fetch + parse title/description/favicon/og:image
│       ├── capture.js           # Playwright MHTML snapshot; PDF passthrough
│       ├── archive.js           # Internet Archive "Save Page Now" submit
│       ├── search.js            # query parser -> AST -> SQL/predicate evaluation
│       ├── netscape.js          # import/export browser bookmark HTML
│       ├── notes.js             # sanitize rich-note HTML (DOMPurify)
│       └── url.js               # address normalization + duplicate matching
├── public/
│   ├── index.html               # SPA shell; sets data-harness-ready when loaded
│   ├── app.js                   # UI: list, search, detail/edit, bulk, views
│   ├── notes-editor.js          # contenteditable formatting toolbar
│   └── styles.css               # layout, density + text-size preference hooks
├── data/                        # runtime (gitignored): bookmarks.db, snapshots/
│   └── snapshots/
├── prototypes/                  # COSPEC screenshots if requested (per CLAUDE.md)
└── tests/
    ├── unit/
    │   ├── search.test.js       # query grammar/eval (node:test)
    │   └── netscape.test.js     # import/export round-trip (node:test)
    └── e2e/
        └── bookmarks.spec.js    # primary flows (@playwright/test 1.61.0)
```

**Structure Decision**: Single deployable web application. One Node process
(Express) serves both the JSON API under `/api/*` and the static frontend from
`public/`. This matches the single-user scope and the runtime environment's
`npm start` on port 4000, avoiding the overhead of separate frontend/backend
builds. Business logic lives in `server/services/*` (unit-testable), thin HTTP
handlers in `server/routes/*`, and persistence is centralized in `server/db.js`.

## Complexity Tracking

No constitution gates are defined, and the plan introduces no unjustified
complexity, so this table is intentionally empty.
