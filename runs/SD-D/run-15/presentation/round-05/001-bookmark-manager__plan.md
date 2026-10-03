# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-based bookmark manager that saves web addresses, automatically
captures each page's title/description/icon/preview image, and lets the user find, open,
annotate, tag, read-later, archive, bulk-edit, sort, save-search, snapshot, and
import/export their collection. The approach is a small **Node.js web application**: an
Express JSON API backed by a **file-based SQLite database** for durable local persistence,
serving a lightweight vanilla-JavaScript single-page front end. Page metadata and
self-contained HTML snapshots are produced server-side (HTTP fetch + HTML parsing, with a
headless Chromium render for snapshots); PDFs are stored as files; Internet Archive
preservation calls an external service with graceful failure. No accounts, no external
databases, no cross-device sync.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**:
- `express` — HTTP server and JSON API (listens on `0.0.0.0:4000`)
- `better-sqlite3` — embedded, file-based SQL storage (synchronous, prebuilt binary)
- `cheerio` — parse fetched HTML for metadata (title, OpenGraph description/image, icon)
- `marked` + `sanitize-html` — render and safely sanitize lightweight Markdown notes
- `playwright` (pinned `1.61.0`) — headless Chromium render for self-contained page snapshots
- `multer` — handle uploaded bookmark-HTML files during import
- `esbuild` — bundle the vanilla-JS client (build step during preparation, not at runtime)

**Storage**: SQLite database file at `data/bookmarks.db`; saved copies (self-contained HTML
snapshots and stored PDFs) as files under `data/snapshots/`. Everything lives below `/work`.

**Testing**: Node built-in test runner (`node:test`) for unit tests (search-query parser,
import/export, metadata parsing); Playwright `1.61.0` (Node) for integration/e2e flows
against a running server, using the shared Chromium at `/opt/playwright-browsers`.

**Target Platform**: Linux server (the shared runtime image); reviewed in a desktop browser
at `http://maker:4000`. VM capture uses `http://127.0.0.1:4000`.

**Project Type**: Web application (single deployable: API + static client from one server).

**Performance Goals**: Search/filter perceived as instant for collections up to ~1,000
bookmarks (SC-005); apply a bulk action to ≥50 selected bookmarks in one operation (SC-006).

**Constraints**: Single user, no authentication. Must degrade gracefully when a page cannot
be fetched (save still succeeds, FR-006) and when the Internet Archive is unavailable
(bookmark unaffected, failure reported, FR-032). Preserve lockfiles; do not download a
second browser version (reuse the installed Playwright 1.61.0 / shared Chromium).

**Scale/Scope**: One personal collection, low thousands of bookmarks; 12 user stories, ~35
functional requirements; ~5 core entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified template with
no concrete principles defined, so there are **no binding constitutional gates** to violate.
The plan nonetheless honors the project's SDD conventions in `CLAUDE.md`:

- **Spec-first**: this plan derives entirely from the approved `spec.md`; no requirement is
  introduced here that is not traceable to a spec item.
- **Testable slices**: work is organized by the spec's independently-testable user stories,
  P1 first (MVP = US1 + US2), so value can be demonstrated incrementally.
- **Simplicity / YAGNI**: one process, one embedded database, no framework on the client, no
  external services except the optional Internet Archive.

**Initial Constitution Check: PASS** (no gates defined). **Post-Design re-check: PASS** — the
Phase 1 design introduces no additional projects, services, or external dependencies beyond
those listed above.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions & rationale
├── data-model.md        # Phase 1 output — entities, fields, relationships
├── quickstart.md        # Phase 1 output — how to run & validate
├── contracts/           # Phase 1 output — API + search-query + import/export contracts
│   ├── api.md
│   ├── search-query.md
│   └── bookmark-html.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already complete)
└── tasks.md             # Created later by /speckit-tasks (NOT by /speckit-plan)
```

### Source Code (repository root)

```text
/work
├── package.json                 # scripts: start, build, test; pinned deps + lockfile
├── package-lock.json
├── .harness/app.json            # runtime descriptor (kind=application, port 4000)
├── src/
│   ├── server/
│   │   ├── index.js             # entry point; builds app, listens on 0.0.0.0:4000
│   │   ├── app.js               # Express app wiring (static client + /api routes)
│   │   ├── db/
│   │   │   ├── connection.js     # opens data/bookmarks.db
│   │   │   └── schema.sql        # tables: bookmarks, tags, bookmark_tags, saved_searches, preferences, saved_copies
│   │   ├── models/              # data-access for each entity
│   │   ├── services/
│   │   │   ├── metadata.js       # fetch page → title/description/icon/preview (FR-002/006)
│   │   │   ├── snapshot.js       # self-contained HTML snapshot / PDF store (FR-030/031)
│   │   │   ├── archive.js        # Internet Archive preservation (FR-032)
│   │   │   ├── search.js         # query parser + evaluator (FR-017–020)
│   │   │   └── porting.js        # Netscape bookmark HTML import/export (FR-033/034)
│   │   └── routes/
│   │       └── api.js            # REST endpoints (see contracts/api.md)
│   └── client/
│       ├── index.html           # SPA shell; sets data-harness-ready when loaded
│       ├── main.js              # app bootstrap, routing between views
│       ├── views/               # list, unread, archive, saved-searches, settings, editor
│       ├── lib/                 # api client, tag-suggest, markdown preview, selection
│       └── styles.css
├── public/                      # esbuild output (built client bundle) served statically
├── data/                        # runtime: bookmarks.db + snapshots/ (created at first run)
└── tests/
    ├── unit/                    # search parser, porting, metadata parsing
    ├── integration/             # API routes against a temp DB
    └── e2e/                     # Playwright flows per user story
```

**Structure Decision**: A single web-application project (one Node process serving both the
JSON API and the static SPA) is the simplest structure that satisfies the runtime contract
(`npm start` → one server on port 4000) and keeps client and server in one codebase. There is
no separate backend/frontend deployment because there is one user and one host. Saved copies
and the database are plain files under `data/`, matching the "local persistence" assumption.

## Complexity Tracking

> No constitution violations to justify. The only notable moving parts are the page-snapshot
> and metadata services, which are inherent to the approved spec (FR-002, FR-030–032) rather
> than incidental complexity; each is isolated behind a single service module and degrades
> gracefully when the network or an external service is unavailable.
