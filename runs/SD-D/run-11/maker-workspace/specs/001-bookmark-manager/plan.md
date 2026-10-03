# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-based bookmark manager that saves web pages with
automatically fetched metadata (title, description, icon, preview image),
supports rich editing with formatted notes and tag suggestions, a powerful
boolean/tag/phrase search, read-later and archive workflows, bulk actions, saved
searches, Netscape-format import/export, local self-contained-HTML page
preservation (PDFs kept as PDFs) with optional Internet Archive submission, and
personal display preferences. All data persists locally.

**Technical approach**: A Node.js web application with a small HTTP API and a
local SQLite database file, serving a lightweight single-page browser UI. Page
metadata and preservation are performed server-side; a headless browser
(Playwright/Chromium, already provided by the image) renders pages to a
self-contained HTML file. The search grammar is handled by a dedicated
hand-written parser/evaluator so operator semantics match the spec exactly.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + static hosting), **`node:sqlite`
(Node's built-in synchronous SQLite — `DatabaseSync`)** for local storage,
express-session (HTTP session cookie), multer (import upload), node-html-parser
(metadata extraction), sanitize-html (safe note + preserved-page HTML),
Playwright 1.61.0 (headless Chromium for self-contained HTML capture). Frontend
is dependency-free vanilla JS/HTML/CSS to keep the lockfile small and the browser
check reliable.

> **Implementation note**: The plan originally specified `better-sqlite3`. During
> implementation that native addon proved unstable on this Node 24 build (an
> intermittent addon init/teardown assertion crashed ~80% of process starts), so
> the storage layer was switched to Node's built-in `node:sqlite`, which is
> API-compatible for our use, needs no native build, and starts reliably. This is
> an internal technology change only; no client-facing behaviour or spec changes.

**Storage**: A single local SQLite database file under `data/` (bookmarks, tags,
notes, states, saved searches, preferences) plus a `data/preserved/` directory
holding self-contained HTML and PDF copies referenced by row.

**Testing**: Node's built-in `node:test` runner for unit tests (search-grammar
parser, address normalisation, Netscape import/export, metadata parsing);
Playwright Test (pinned 1.61.0) for a smoke check of the running UI.

**Target Platform**: Linux container; server listens on `0.0.0.0:4000`; UI runs
in Chromium. Reached by the client at `http://maker:4000`.

**Project Type**: Web application (single deployable: API + served static SPA).

**Performance Goals**: Search across 1,000 bookmarks returns in under 10 s
(target well under 1 s); save-with-metadata flow completes within a few seconds
subject to the target site's response.

**Constraints**: Single-user, local-only storage, no accounts/sync (per spec).
Must degrade gracefully when a target page, metadata fetch, preservation, or the
Internet Archive service is unavailable. HTTP session cookies must work in the
review environment.

**Scale/Scope**: Personal collection sized in the thousands of bookmarks; 12
prioritised user stories; a handful of screens (main list, unread, archive,
editor, preferences, saved searches, import/export).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is an unratified
template (all principle placeholders are unfilled). There are therefore **no
ratified principles or gates to enforce**. No violations. Should the client
ratify a constitution later, this plan will be re-checked against it.

**Result**: PASS (no active constitution constraints).

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
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
package.json             # Node app; "start" launches the server on 0.0.0.0:4000
package-lock.json
src/
├── server.js            # Express app: static hosting + API routes + session
├── db/
│   ├── index.js         # SQLite connection + schema/migrations
│   └── schema.sql       # Table definitions
├── services/
│   ├── bookmarks.js     # CRUD, read/archive state, bulk actions
│   ├── metadata.js      # Fetch + parse title/description/icon/preview
│   ├── normalize.js     # Address normalisation + duplicate detection
│   ├── search.js        # Search grammar parser + evaluator
│   ├── tags.js          # Tag assignment + suggestions
│   ├── savedSearches.js # Saved query + included/excluded tags
│   ├── preserve.js      # Self-contained HTML capture; PDF passthrough
│   ├── archiveOrg.js    # Optional Internet Archive submission
│   ├── netscape.js      # Netscape bookmark import/export
│   └── preferences.js   # Display preferences
├── routes/              # Thin HTTP handlers mapping to services
└── public/              # Vanilla JS SPA (index.html, app.js, styles.css, views)

data/                    # Created at runtime: bookmarks.db + preserved/ copies

tests/
├── unit/                # search grammar, normalize, netscape, metadata parse
└── smoke/               # Playwright: app loads, save + list render

.harness/app.json        # Runtime presentation manifest (kind: application, 4000)
```

**Structure Decision**: A single Node web-application project (API + served
static SPA in one deployable) matches the "single browser app, local storage, no
separate services" scope. Services are split by spec concern so each functional
area (metadata, search, preservation, import/export, …) is independently
testable, and routes stay thin.

## Complexity Tracking

No constitution violations to justify (no ratified constitution). Table omitted.
