# Design decisions (Cycle 1)

Lightweight record to enable impact analysis in later cycles. Production code
lives in `implementation/`; it was written fresh from the approved scenarios'
behaviour, not adapted from the Phase 1 prototype.

## Architecture
- **Node.js + Express** single server (`server.js`) serving a REST API and a
  static browser frontend (`public/`). Node 24's global `fetch` is used; the only
  runtime dependency is Express. Chosen to avoid native builds and keep the
  lockfile small; a single user, local-first app does not need a database.
- **Persistence: JSON file** (`src/store.js` → `data/db.json`) with atomic
  temp-file + rename writes. Alternative dropped: SQLite (native build risk,
  unnecessary for this scale).
- **Search / sort / pagination run in the browser** over the full data set
  (`/api/state` returns everything). The data set for one user is small; this
  keeps the query language, sorting, and "select all in view" logic in one place
  and makes them instant. Alternative dropped: server-side query endpoints
  (more round-trips, duplicated query logic).
- **Shared pure modules** in `src/` are served to the browser under `/src` and
  imported by both Node tests and `public/app.js`, so the exact tested code runs
  in the browser (`query.js`, `markdown.js`, `urls.js`).

## Key behavioural decisions
- **Duplicate matching** ignores scheme, leading `www.`, and trailing slash,
  case-insensitively (`urls.normalizeUrl`). Applies to create and to editing a
  link (SCN-003, SCN-005).
- **File kind** (page vs PDF) is decided from the returned **content type**,
  falling back to the address (`urls.detectFileKind`) (SCN-020).
- **Preserved copy** is captured automatically at save, in the background, so
  saving stays responsive; failures leave `snapAt=null` and offer retry
  (SCN-011, SCN-020).
- **Network features degrade gracefully** and honour `BOOKMARKS_OFFLINE=1`
  (deterministic tests) and `FETCH_TIMEOUT_MS` (metadata.js).
- **Imports arrive as `status:'done'` (reference)** so a bulk import does not
  flood "To read" (SCN-023).
- **Notes** stored as raw Markdown; rendered read-only via `markdown.js`; raw
  HTML escaped, only http/https links linkified (SCN-019).
- **Composer reset guard**: after saving, the URL field is only cleared if it
  still holds the just-saved URL, so a quickly-typed next URL is not wiped.

## Environment flags
- `PORT` (default 4000), `BOOKMARKS_DATA` (data dir, default `data`),
  `BOOKMARKS_OFFLINE=1` (short-circuit network to degraded results),
  `FETCH_TIMEOUT_MS` (metadata fetch timeout ms, default 8000).
