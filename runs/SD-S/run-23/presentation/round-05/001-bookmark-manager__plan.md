# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application to save, organize, and reopen web bookmarks. Users
save a link by pasting an address; the server fetches the page and auto-collects
its title, description, and favicon, all editable. Bookmarks can be tagged
(choosing existing tags or creating new ones), filtered by tag, searched, edited,
and deleted. Saving an already-saved address navigates to the existing bookmark
rather than creating a duplicate. Data persists on the server so bookmarks
survive restarts.

**Technical approach**: A small Node.js web service exposes a REST/JSON API and
serves a single-page browser UI. Bookmarks and tags are stored in a local SQLite
database file. Page-metadata collection happens server-side (fetching the target
HTML and parsing Open Graph / standard `<meta>`/`<title>`/icon tags), which
avoids browser CORS limits and keeps the client simple.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP server + static hosting), node-html-parser
(metadata extraction). Storage uses the built-in `node:sqlite` module (Node 24),
so no native database addon is required. Global `fetch` (built into Node 24) for
retrieving target pages. No frontend framework — vanilla HTML/CSS/JS served as
static assets.

**Storage**: SQLite database file on local disk (`data/bookmarks.db`).

**Testing**: Node's built-in `node:test` runner for unit/integration tests;
Playwright 1.61.0 (pinned) for an end-to-end smoke test of the primary flows.

**Target Platform**: Modern desktop browser (client); Linux container (server),
listening on `0.0.0.0:4000`.

**Project Type**: Web application (backend service + static single-page frontend).

**Performance Goals**: Bookmark list visible within 2s of opening the app
(SC-005); auto-collected details shown within 5s for reachable pages in ≥90% of
cases (SC-006); search/tag-filter results in a 200-item collection feel instant
(<5s to locate, SC-004).

**Constraints**: Metadata fetch must never block saving — it runs with a short
timeout and falls back gracefully. Single-user, no authentication. HTTP-session
cookies not required (stateless API). Server must survive model-call end
(detached start per harness).

**Scale/Scope**: Single user; hundreds to low-thousands of bookmarks; ~5 API
endpoints; one screen (list + add/edit dialog).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified
template containing only placeholder principles — no concrete, enforceable gates
are defined. There are therefore no constitutional constraints to violate.

Applied engineering defaults in the spirit of a constitution: keep it a single
project (no unnecessary services), prefer the standard library and a minimal
dependency set, and keep storage and logic testable. **PASS** (initial).

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
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # Express app entry: wires routes, serves static, listens 0.0.0.0:4000
├── db.js                # node:sqlite connection + schema init/migration
├── metadata.js          # Fetch target page, parse title/description/favicon (with timeout)
├── bookmarks.js         # Bookmark data access + business rules (dedupe, tag normalization)
└── routes/
    └── api.js           # REST endpoints for bookmarks and tags

public/                  # Static single-page frontend served by the server
├── index.html           # App shell; sets data-harness-ready when list has loaded
├── app.js               # UI logic: list, add/edit dialog, tag filter, search
└── styles.css

data/
└── bookmarks.db         # SQLite file (created at runtime; not committed)

tests/
├── unit/                # metadata parsing, tag normalization, dedupe rules
├── integration/         # API endpoint behavior against a temp SQLite db
└── e2e/                 # Playwright smoke test of save → list → tag/filter → edit → delete

package.json             # scripts: start, test; dependencies pinned
.harness/app.json        # runtime descriptor (kind: application, port 4000)
```

**Structure Decision**: Single web-application project with a thin Express
backend and a static vanilla-JS frontend served from the same origin (avoids
CORS and a separate build step). Metadata collection lives server-side in its own
module so it can be unit-tested and timed out independently of request handling.

## Complexity Tracking

No constitution violations to justify; this section is intentionally empty.
