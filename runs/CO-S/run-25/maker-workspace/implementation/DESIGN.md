# Design decisions — Link Library (cycle 1)

Production implementation built in Phase 2 from the approved scenarios' GWT
(SCN-001 … SCN-012). Not derived from the Phase 1 prototypes.

## Stack
- **Node.js built-ins only** (`node:http`, `node:fs`) — no external runtime
  dependencies, so nothing needs installing to run. Dev/test uses the built-in
  `node:test` runner plus Playwright 1.61.0 (pre-installed in the image) for one
  browser e2e.
- **Storage**: a single JSON file (`data/bookmarks.json`) plus preserved-copy
  files under `data/copies/`. Chosen for zero-dependency durability at personal
  scale. Alternative dropped: SQLite (would need a native/3rd-party dep).
- **Search runs client-side** using the shared `query.js`, so filtering is live
  per keystroke without server round-trips. The same module is unit-tested in
  Node. Alternative dropped: server-side search endpoint (extra latency for live
  filtering; the engine is small).

## Structure
- `shared/urls.js` — normUrl, hostOf, canon (duplicate equivalence),
  isPlausibleUrl, isPdf. UMD so it loads in Node and the browser.
- `shared/query.js` — search query engine (boolean parser + matcher). UMD.
- `src/store.js` — persistence + copy files.
- `src/fetcher.js` — fetch page → title/description + preserved copy; PDFs kept
  as original bytes; HTTP layer injectable for tests. Returns `{ok:false}` on any
  failure (drives the "copy unavailable" path).
- `src/service.js` — enforces approved behaviour (validation, dedupe, capture,
  edit/recapture, tags, note, reading list, archive, bulk, delete).
- `src/app.js` — HTTP routing + static file serving; maps ValidationError codes to
  status codes (400/404/409).
- `src/server.js` — entry point; binds real fetcher; listens on 0.0.0.0:4000.
- `public/` — the single-page UI (`index.html`, `styles.css`, `app.js`).

## Key behavioural choices (traceable to scenarios)
- Duplicate equivalence ignores scheme/www/trailing-slash/#fragment; query string
  is significant (SCN-008) — see `canon`.
- Operators must be capitalised; lowercase and/or/not are plain words (SCN-004) —
  see `isOp` (exact match).
- On address change, tags & note are preserved but details + copy are re-fetched
  (SCN-008) — see `service.edit`.
- Capture failure keeps the link and marks copy `unavailable` with Retry (SCN-011)
  — see `service.captureInto`.
- Nothing auto-expires; snapshots are fixed until the user re-captures (SCN-012) —
  state only changes on explicit user actions.

## Non-functional items deferred (see context/non-functional-backlog.md)
Layout polish, capture depth/limits for login-gated & large pages, storage
footprint, list performance at scale, date-display style, auto vs manual retry.
