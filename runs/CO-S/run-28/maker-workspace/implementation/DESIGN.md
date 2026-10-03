# Bookmarks — internal design & traceability

Cycle 1 implementation. Built from the approved GWT scenarios (SCN-001..010), not
from the Phase 1 prototype code.

## Architecture (design decisions)

- **Small Node/Express server + static browser client.** Chosen because the goal
  requires (a) real page-title retrieval, which browsers cannot do cross-origin, and
  (b) durable persistence across sessions (SCN-010). A pure static app could not do
  either dependably. Alternative dropped: browser-only + localStorage — rejected
  because it cannot fetch titles and ties data to one browser profile.
- **Server is authoritative for persistence, validation, dedupe, and titles.**
  The client loads the full collection once and does all browsing/search/filtering
  locally for a responsive feel (SCN-003, SCN-004). Alternative dropped: server-side
  filtering endpoints — unnecessary for a single-user collection and would make live
  search/highlight less snappy.
- **JSON file storage** (`data/bookmarks.json`) via a small `Store` class. Adequate
  and dependable for a single-user personal collection; no external DB dependency.
  Could be swapped for SQLite later without changing the API.
- **Optimistic UI on save**: the card appears immediately with a "reading title"
  placeholder, then is replaced by the server's saved record (SCN-001). Errors roll
  the optimistic card back and show a message.
- **Title fetch failures never block saving**; the address is stored as the title
  and can be renamed (SCN-009). `novalidate` on the form so our own inline messages
  (not the browser's native bubble) handle invalid input (SCN-008).

## Modules

- `store.js` — persistence + domain rules (normalizeUrl, looksLikeUrl, canonical,
  normalizeTags, CRUD, findDuplicate).
- `title.js` — server-side title retrieval with URL fallback (injectable fetch).
- `server.js` — `createApp({store, titleFetcher})` factory + REST API + static host.
- `public/` — `index.html`, `styles.css`, `app.js` (client behaviour).

## API

- `GET  /api/bookmarks` → all, newest first.
- `POST /api/bookmarks` {url, tags} → 201 bookmark | 400 {error:empty|invalid} | 409 {error:duplicate, bookmark}.
- `PATCH /api/bookmarks/:id` {title?, tags?, toRead?, archived?} → 200 | 404.
- `DELETE /api/bookmarks/:id` → 204 | 404.

## Scenario → code mapping

| Scenario | Code | Tests |
|---|---|---|
| SCN-001 save + auto title | server.js POST, title.js, app.js submit/optimistic | api.test (SCN-001), title.test, ui.test (SCN-001) |
| SCN-002 edit title+tags | store.update, app.js renderEditForm | store.test (update), api.test (SCN-002), ui.test (SCN-002) |
| SCN-003 tags + browse + suggest | store.normalizeTags, app.js renderTagbar/attachSuggest | store.test (normalizeTags), ui.test (SCN-003 ×2) |
| SCN-004 search | app.js matches/hl/render | ui.test (SCN-004) |
| SCN-005 read-later queue | store.update(toRead), app.js toggleRead/inView | api.test (SCN-005), ui.test (SCN-005) |
| SCN-006 archive/restore | store.update(archived), app.js setArchived/inView | api.test (SCN-006), ui.test (SCN-006) |
| SCN-007 delete + confirm | store.remove, server DELETE, app.js askDelete/delOverlay | store.test (remove), api.test (SCN-007), ui.test (SCN-007) |
| SCN-008 invalid + duplicate | store normalizeUrl/looksLikeUrl/canonical/findDuplicate, server POST, app.js validation/showDuplicate | store.test (×4), api.test (×3), ui.test (SCN-008) |
| SCN-009 title fetch fallback | title.js fetchTitle, store.add title fallback | title.test, api.test (SCN-009), store.test (add) |
| SCN-010 persistence + single-user | Store load/_save, JSON file, no auth | store.test (persistence), api.test (SCN-010) |

## Deferred (later cycles): LCR-001 page snapshot, LCR-002 notes/descriptions,
LCR-003 trash/undo. Non-functional: NFR-001 responsive (implemented via responsive
CSS; formal review deferred).

## Running

- `npm start` (defaults: PORT=4000, DATA_FILE=./data/bookmarks.json).
- `npm test` runs all suites (set PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
  for the browser tests).
