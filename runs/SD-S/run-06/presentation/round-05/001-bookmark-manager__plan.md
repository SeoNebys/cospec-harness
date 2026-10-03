# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web app to save, organize, find, and manage web bookmarks. Users
save a bookmark by pasting an address; the app automatically collects the page's
title, description, and icon. Bookmarks are organized with free-form reusable
tags, retrieved via case-insensitive search and tag filtering, edited (address,
title, description) and deleted. Re-saving a known address opens the existing
bookmark for update instead of creating a duplicate.

Technical approach: a small Node.js web service serves a browser UI and a JSON
REST API, persisting to a local SQLite database file. A server-side endpoint
fetches destination-page metadata (title/description/icon) so automatic
collection is not blocked by browser cross-origin restrictions. Everything runs
locally as one process; no accounts, auth, or sync in v1.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + REST API); better-sqlite3
(synchronous local SQLite access); node-html-parser (extract `<title>`, meta
description, and icon link from fetched HTML). Native `fetch` (built into
Node 24) for metadata retrieval. Frontend is plain HTML/CSS/vanilla JS served as
static assets — no build step.

**Storage**: Local SQLite database file (`data/bookmarks.db`), created on first
run. Single-user, single-device.

**Testing**: Node's built-in test runner (`node --test`) for unit/contract tests
of the API and metadata parser; Playwright 1.61.0 (pinned) for one end-to-end UI
flow.

**Target Platform**: Modern desktop web browser; server runs as a local Node
process.

**Project Type**: Web application (backend API + static frontend), single
deployable process.

**Performance Goals**: Bookmark list renders without visible delay for 500+
bookmarks; save action returns immediately (SC-001) with metadata collected
best-effort without blocking the user.

**Constraints**: Save must not block on metadata collection (FR-004, SC-001);
duplicate detection normalizes case and trailing slash (FR-015); search is
case-insensitive (FR-011); data persists across restarts (FR-005, SC-002). Server
listens on `0.0.0.0:4000` per the runtime presentation environment.

**Scale/Scope**: Single user; hundreds to a few thousand bookmarks; ~6 REST
endpoints; ~4 UI views (list, add/edit form, tag filter, search).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) contains only
unfilled template placeholders — no ratified principles or constraints are
defined. There are therefore no explicit gates to evaluate. The plan
nonetheless follows sensible defaults: a single project, no unnecessary
abstraction layers (direct data-access module rather than a repository/ORM
stack), and tests for the API contract and one end-to-end flow.

**Result**: PASS (no active constitutional constraints; no violations to justify).

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
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── server.js            # Express app entry: static hosting + API mount, listens 0.0.0.0:4000
├── db.js                # SQLite connection + schema init (bookmarks, tags, bookmark_tags)
├── metadata.js          # Fetch + parse destination-page title/description/icon
├── bookmarks.js         # Data-access + business logic (CRUD, normalize address, dedupe, search)
└── public/              # Static frontend (no build step)
    ├── index.html       # List, search box, tag filter, add/edit form
    ├── app.js           # UI logic: calls REST API, renders list, handles edit/delete/filter
    └── styles.css       # Layout + readable truncation of long titles/addresses

tests/
├── contract/
│   └── api.test.js      # Asserts REST endpoints match contracts/api.md
├── unit/
│   ├── normalize.test.js  # Address normalization + duplicate detection (FR-015)
│   └── metadata.test.js   # HTML metadata extraction + fallbacks (FR-003/FR-004)
└── e2e/
    └── flow.spec.js     # Playwright: save → appears → tag → filter → edit → delete

data/                    # SQLite file created at runtime (gitignored)
package.json             # scripts: start, test; deps pinned incl. playwright 1.61.0
```

**Structure Decision**: Single web-application project. One Node process serves
both the static frontend (`src/public/`) and the REST API (`src/server.js`),
keeping deployment to a single `npm start` on port 4000 as required by the
runtime environment. Business logic lives in `bookmarks.js` and `metadata.js`,
separated from HTTP concerns for direct unit testing.

## Complexity Tracking

No constitution violations; no complexity to justify.
