# Bookmark Keeper — internal information system

Production implementation for Cycle 1. Built from the approved GWT scenarios
(context/scenarios/), not from the Phase 1 prototype.

## Architecture / design decisions

- **Zero external dependencies.** Node.js 24 built-ins only (`http`, `fs`, global
  `fetch`, `node:test`). *Why:* the app is a single-user personal tool; avoiding a
  framework and a package lockfile keeps the trial reproducible and removes browser/
  dependency-download concerns. *Dropped:* Express + SQLite (unnecessary weight for
  one user).
- **Storage = JSON file + snapshot files** (`data/bookmarks.json`, `data/snapshots/<id>.html`).
  Writes are atomic (temp file + rename). *Why:* durable persistence (SCN-011) with
  no DB server. *Dropped:* SQLite/better-sqlite3 (adds a native dependency).
- **Data rules live in `lib/store.js` + `lib/validate.js`**, separate from the HTTP
  layer (`server.js`) and network access (`lib/fetchpage.js`). *Why:* the rules
  (validation, duplicate rejection, defaults) are unit-testable without a server.
- **Server is the source of truth** for validation, duplicate prevention, and
  defaults; the browser mirrors messages for UX but cannot bypass the rules.
- **Title lookup and page snapshot use real network `fetch`** with an 8s timeout and
  a 3 MB cap, and **degrade gracefully** when a page is unreachable (empty title the
  user can fill; snapshot marked unavailable). *Why:* external services may be down;
  the app must not break (edge-case: error/exception states).
- **Snapshot content** is reduced to readable text at capture time (scripts/styles
  stripped). *Why:* SCN-005 keeps the information useful, not a pixel-perfect page.

## Scenario → code mapping

| Scenario | Where implemented |
|----------|-------------------|
| SCN-001 save + auto title | `server.js` POST /api/bookmarks + GET /api/lookup-title; `lib/fetchpage.js` lookupTitle/extractTitle; `public/app.js` lookupTitle/save; newest-first in `store.list()` |
| SCN-002 tags + tag filter | `lib/validate.js` normalizeTags; `store.create/update`; `public/app.js` pending tags, renderFilterBar, tag click |
| SCN-003 search all fields | `public/app.js` matchesSearch + render |
| SCN-004 to-read tracking | `store.create` default toread; PUT toggle; `public/app.js` renderReadTabs, mark toggle |
| SCN-005 safety-net copy | `server.js` capturePage on create/update, GET /api/snapshot/:id; `lib/fetchpage.js` capturePage/extractReadableText; `store.setSnapshot/getSnapshot`; `public/app.js` showSavedCopy |
| SCN-006 edit link | `store.update`; `server.js` PUT; `public/app.js` editForm |
| SCN-007 duplicate prevention | `lib/validate.js` sameUrl; `store.findByUrl`, create/update duplicate branch; `server.js` 409; `public/app.js` showDuplicate + goToItem |
| SCN-008 address validation | `lib/validate.js` normalizeUrl/isValidUrl; `store.create` empty/invalid; `server.js` 400; `public/app.js` error display |
| SCN-009 empty states | `public/app.js` render() empty branches |
| SCN-010 remove w/ confirm | `store.remove`; `server.js` DELETE; `public/app.js` confirmDelete |
| SCN-011 persistence | `lib/store.js` JSON load/_save; snapshots on disk |

## Tests

- `test/unit.test.js` — `node --test`: validation, store rules, parsing, persistence.
- `test/acceptance.py` — Playwright (Python, system install) end-to-end against the
  running server, mapped to the Gherkin scenarios. See Phase 3 (verification.md).

## Run

- `npm start` (or `node server.js`) — listens on `0.0.0.0:4000`.
- `DATA_DIR` env overrides the storage location (used by tests).
