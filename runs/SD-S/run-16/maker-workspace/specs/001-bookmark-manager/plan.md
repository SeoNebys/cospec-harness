# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, single-device web app for saving and managing bookmarks. The
user saves a web address; the bookmark is persisted and shown immediately, then
the server fetches the page's real title, description, favicon, and preview
image **in the background** (choice A) and updates the record in place. Users
can browse, keyword-search, tag/filter, edit, and delete bookmarks. Saving a
duplicate address routes the user to editing the existing bookmark.

**Technical approach**: A small Node.js web service exposes a JSON API and
serves a lightweight browser UI. Bookmarks live in a local SQLite database file
(survives restarts, no external service). Metadata enrichment runs server-side
(so it is not blocked by browser CORS) as an asynchronous task kicked off right
after the immediate save; the UI reflects an enrichment status and shows fetched
details once ready. A bounded fetch timeout guarantees saving never hangs.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules), served to a modern browser

**Primary Dependencies**: Express 5 (HTTP API + static hosting), better-sqlite3 (embedded storage), cheerio (HTML metadata parsing), Node global `fetch`/`AbortController` (metadata retrieval). Frontend is dependency-free vanilla HTML/CSS/JS.

**Storage**: SQLite database file at `data/bookmarks.db` (file-based, single-device persistence). Favicon/preview stored as remote URLs (references), not binary blobs, for v1.

**Testing**: Node.js built-in test runner (`node:test`) for unit/service tests; Playwright 1.61.0 (pinned) for end-to-end browser tests against the running app.

**Target Platform**: Linux container serving `0.0.0.0:4000`; reviewed via `http://maker:4000`. UI usable on desktop and phone browsers.

**Project Type**: Web application (single deployable: API + served static frontend).

**Performance Goals**: Save action visible in the list in < 1 s (well under SC-001's 20 s). Keyword search over 100+ bookmarks returns in < 300 ms (supports SC-002). Background metadata fetch bounded by an 8 s timeout so it never blocks the user (SC-007).

**Constraints**: No user accounts, login, or cross-device sync (v1 scope). Outbound internet access required for enrichment; must degrade gracefully when a page is unreachable or exposes no metadata. HTTP server binds `0.0.0.0`; app on port 4000. Session cookies not required (no auth in v1).

**Scale/Scope**: Personal scale — up to a few thousand bookmarks on one device. Roughly 3 screens/views (list+search, add/edit form, empty state) and ~7 API endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template — it defines no ratified, binding principles yet. There are therefore
no explicit constitutional gates to enforce. The plan nonetheless follows the
sensible defaults the template gestures at:

- **Simplicity / YAGNI**: One deployable, one datastore, no framework on the
  frontend, no auth layer (matches single-user v1 scope). ✅
- **Test-first discipline**: Contracts and a quickstart validation guide are
  produced before implementation; tasks will front-load tests. ✅
- **Observability**: Server logs enrichment outcomes (success / timeout /
  failure) so background behavior is debuggable. ✅

**Gate result**: PASS (no violations; Complexity Tracking left empty).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Approved specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # HTTP/JSON API contract
└── checklists/
    └── requirements.md  # Spec quality checklist (passing)
```

### Source Code (repository root)

```text
src/
├── server.js            # App entry: Express setup, static hosting, listen on 0.0.0.0:4000
├── db.js                # SQLite connection + schema migration/bootstrap
├── models/
│   └── bookmark.js      # Bookmark data access (CRUD, search, tag filter, dedupe lookup)
├── services/
│   ├── metadata.js      # Fetch + parse page title/description/favicon/preview (timeout-bounded)
│   ├── enrichment.js    # Background enrichment orchestration + status updates
│   └── url.js           # URL validation + normalization (scheme-less input)
└── routes/
    └── bookmarks.js     # JSON API route handlers

public/                  # Dependency-free frontend served as static assets
├── index.html           # List + search + tag filter + add/edit form; sets data-harness-ready
├── app.js               # UI logic: render list, search, tag filter, add/edit/delete, poll enrichment
└── styles.css

data/
└── bookmarks.db         # SQLite file (created at runtime; gitignored)

tests/
├── unit/
│   ├── url.test.js          # URL normalization/validation
│   └── metadata.test.js     # Metadata parsing from sample HTML (no network)
├── integration/
│   └── api.test.js          # API endpoints against an in-process app + temp DB
└── e2e/
    └── bookmarks.spec.js    # Playwright: save → appears → enrich fills in → search → edit → delete
```

**Structure Decision**: Single web-application deployable. The API and the
static frontend ship together from one Node process (simplest thing that meets
the single-user, single-device scope and the runtime's port-4000 delivery
model). `src/` holds server code split into models/services/routes for
testability; `public/` holds the framework-free UI; `data/` holds the SQLite
file that provides persistence across restarts.

## Complexity Tracking

> No constitutional violations to justify — section intentionally empty.
