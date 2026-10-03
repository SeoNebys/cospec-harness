# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application to save, preserve, and manage bookmarks. On save it
fetches page details (title, description, favicon, preview thumbnail) and captures
a faithful static snapshot of the page — keeping PDFs as PDFs — then lets the user
browse, search, filter by tag, sort, mark read-later, add notes, archive/restore,
and permanently delete. Supports importing and exporting the standard browser
(Netscape) HTML bookmark format, mapping folders to tags.

Technical approach: a Node.js web server exposing a REST API and serving a
lightweight browser UI. Bookmark metadata is stored in a local embedded database;
snapshots, thumbnails, and favicons are stored as files on local disk. Page
detail extraction and snapshot capture use a headless Chromium browser
(Playwright): meta/OpenGraph parsing for details, a full-page screenshot for the
thumbnail, and a single-file archive (MHTML) for web-page snapshots; PDF targets
are stored as their original bytes.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + REST API + static hosting);
better-sqlite3 (embedded local database); Playwright 1.61.0 with the shared
Chromium (page detail fetch, snapshot, thumbnail); node-html-parser (parse
metadata and Netscape bookmark HTML). Frontend is dependency-light vanilla
JavaScript + HTML/CSS served as static files (no build step).

**Storage**: SQLite database file at `data/bookmarks.db` for bookmark/tag records;
local filesystem under `data/snapshots/`, `data/thumbnails/`, `data/favicons/`
for captured assets. No external service.

**Testing**: Node built-in test runner (`node:test`) for unit/contract tests;
Playwright 1.61.0 (pinned to match the shared browser binaries) for end-to-end UI
tests.

**Target Platform**: Linux container; served over HTTP on `0.0.0.0:4000`, reached
by the client at `http://maker:4000`.

**Project Type**: Web application (single deployable: API + served static UI).

**Performance Goals**: Save-to-listed under 20s including detail fetch and
snapshot (SC-001); search/filter/sort a 100+ item collection returns in under 10s
of user effort, results computed in well under 1s (SC-003).

**Constraints**: Single-user, no authentication; all data local and durable
across restarts; snapshot/detail capture happens once at save time (no ongoing
link-health checks); graceful fallback when a page's details or snapshot cannot
be captured; server must listen on `0.0.0.0` and start via `npm start`.

**Scale/Scope**: Single user; on the order of thousands of bookmarks; 8 user
stories, 23 functional requirements, ~4 primary views (all / unread / archive /
detail-edit).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is an unpopulated
template with no ratified principles. There are therefore no concrete governance
gates to enforce. General good-practice defaults are applied (testable
requirements, clear separation of storage/capture/API/UI, no unnecessary
complexity). **No violations. Gate: PASS** (initial and post-design).

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
└── tasks.md             # Phase 2 output (/speckit-tasks - not created here)
```

### Source Code (repository root)

```text
package.json             # scripts (start, test), pinned deps incl. playwright@1.61.0
server.js                # app entry: creates Express app, listens on 0.0.0.0:4000

src/
├── db.js                # SQLite connection + schema/migrations
├── models/
│   ├── bookmark.js      # CRUD, status/archive transitions, duplicate lookup
│   └── tag.js           # tag upsert, association, listing
├── services/
│   ├── capture.js       # Playwright: fetch details, thumbnail, snapshot; PDF passthrough
│   ├── metadata.js      # parse title/description/favicon/preview from HTML
│   └── porting.js       # Netscape bookmark HTML import/export (folders→tags)
├── routes/
│   ├── bookmarks.js     # /api/bookmarks endpoints (list/search/sort/filter, CRUD, status, archive)
│   ├── snapshots.js     # serve stored snapshots/thumbnails/favicons
│   └── porting.js       # /api/import, /api/export
└── util/
    └── url.js           # address validation + normalization for duplicate detection

public/                  # served static UI (no build step)
├── index.html           # app shell; views: all / unread / archive / detail-edit
├── app.js               # UI logic: rendering, search/sort/filter, actions
└── styles.css

data/                    # runtime storage (gitignored)
├── bookmarks.db
├── snapshots/
├── thumbnails/
└── favicons/

tests/
├── unit/                # url validation, metadata parsing, porting mapping (node:test)
├── contract/            # REST endpoint request/response shape (node:test)
└── e2e/                 # Playwright 1.61.0 UI flows
```

**Structure Decision**: A single web-application deployable. The Node/Express
server exposes the REST API under `/api/*`, serves captured assets, and hosts the
static `public/` UI. This keeps one process, one `npm start`, and satisfies the
runtime presentation requirements (single port 4000, `0.0.0.0`). No frontend
build step keeps the toolchain and lockfile simple and reproducible.

## Complexity Tracking

> No constitution violations; no entries required.
