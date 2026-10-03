# Design-decision record — My Bookmarks (cycle 1)

Production implementation built from the approved scenarios' specifications
(context/scenarios/SCN-001..019). Not derived from the Phase 1 prototype.

## Architecture
- **Single-user, no sign-in** (approved scope): a Node.js + Express server serving
  a static browser app and a small REST API. Reachable from computer and phone
  over one shared server (listens on 0.0.0.0, port 4000).
- **Persistence:** durable JSON file (`data/db.json`) written atomically
  (temp-file + rename) on every change. Offline copies are stored as files under
  `data/offline/`. Rationale: personal-scale data; a relational DB adds no value
  here and JSON keeps the store dependency-free. Alternative dropped: SQLite
  (native build, unnecessary for the data volume).
- **Where list logic runs:** the browser loads the full collection and performs
  search / sort / paging / selection locally using shared pure modules in `src/`.
  This guarantees counts and "Select all" always cover the full result set while
  the page size only limits how many rows are rendered (SCN-018). The server is
  the source of truth and re-validates writes (dedup, uniqueness, validity).

## Shared domain modules (`src/`, pure, unit-tested, used by server + browser)
- `urls.js` — normalisation, validity (SCN-011), duplicate key (SCN-002), PDF
  detection (SCN-016).
- `tags.js` — tag normalisation + de-dup (SCN-008).
- `search.js` — query language: case-insensitive substring, "phrases",
  AND/OR/NOT (case-insensitive), parentheses, implicit AND, `#tag` (SCN-004/008).
- `sort.js` — sort comparators incl. "recently updated" (SCN-013).
- `markdown.js` — safe Markdown for notes; escapes first so raw HTML/scripts are
  never executed (SCN-009).
- `importexport.js` — Netscape bookmarks HTML read/write (SCN-017).

## Server-only modules (`src/`)
- `store.js` — JSON persistence + id sequence.
- `metadata.js` — fetches real page title/description/og-image/host; returns
  `{failed:true}` fallback when unreachable (SCN-001/011).
- `offline.js` — captures a single-file page snapshot or preserves the PDF;
  throws (surfaced as HTTP 502) on fetch failure — nothing fake is stored (SCN-016).
- `archive.js` — manual Internet Archive submission; returns a public snapshot
  URL; never automatic on save (SCN-016).

## Key rules encoded on the server
- Create rejects invalid URLs (400) and duplicates (409 with existing id).
- "Recently updated" (`updatedAt`) is bumped on edits, notes, tags, reading
  status and archive status — and by bulk versions of those — but NOT by offline
  capture or Archive submission (SCN-013/016).
- Saved-search names are unique, case-insensitively (409 on reuse) (SCN-015).
- Import adds, skips duplicates, keeps titles/tags/dates, defaults missing dates
  to today, and starts items ordinary (SCN-017).
- Export always covers the whole collection incl. archived (SCN-017).

## Tests
- `test/unit/*` — pure domain modules (node:test).
- `test/integration/*` — the API over real HTTP, with a local origin server so
  metadata-fetch and offline-capture run without external network.
- `test/e2e/*` — Playwright drives the real UI through the approved scenarios,
  pinned to Playwright 1.61.0 using the shared browser binaries.
