# Internal information system — Bookmarks app (Cycle 1)

Lightweight design record + scenario→code mapping to enable impact analysis in
later cycles and, if requested, generation of traditional artifacts.

## Architecture

- **Runtime:** Node.js + Express. Single small web app serving a static
  front-end and a JSON API. No framework on the client (plain DOM).
- **Persistence:** file-backed JSON document (`data/bookmarks.json`), loaded
  into memory on start and written atomically (temp file + rename) on every
  change. Chosen over a database to satisfy "survives across sessions"
  (SCN-008) with zero external services. Data shape: `{ bookmarks: [...],
  nextId }`.
- **Title fetching:** server-side `fetch` of the URL, `<title>` extracted by
  regex + entity decode, with a timeout and content-type guard. Runs on the
  server (not the browser) to avoid cross-origin restrictions.
- **Dependency injection:** `createApp({ store, fetchTitle })` so tests use an
  in-memory store and a deterministic stub fetcher (offline, no network).

## Modules

| File | Responsibility |
|------|----------------|
| `src/logic.js` | Pure domain logic: URL/tag normalisation, duplicate detection, filtering, unread count, tag list. Unit-tested. |
| `src/store.js` | Load/atomic-save the JSON data file. |
| `src/titleFetcher.js` | Fetch + parse the real page title; `{ ok, title }`. |
| `src/server.js` | Express app factory + REST endpoints. |
| `src/index.js` | Wires real store/fetcher, listens on 0.0.0.0:4000. |
| `public/` | UI: `index.html`, `style.css`, `app.js`. |

## API

- `GET /api/bookmarks` → `{ bookmarks, allTags, unreadCount, total }`
- `POST /api/bookmarks { url, readLater }` → 201 `{ bookmark }` /
  400 invalid / 409 `{ duplicate, bookmark }`
- `PATCH /api/bookmarks/:id { title?, tags?, readLater?, read? }` → `{ bookmark }`
- `DELETE /api/bookmarks/:id` → 204 / 404

## Scenario → code mapping

| Scenario | Behaviour | Code |
|----------|-----------|------|
| SCN-001 | Save link, fetch real title, newest-first, rename | `server.js` POST + PATCH(title); `titleFetcher.js`; `app.js` save()/card()/commitName |
| SCN-002 | Free-form, lower-cased, reusable tags + suggestions | `logic.normaliseTag`/`allTags`; `server.js` PATCH(tags); `app.js` buildTags() |
| SCN-003 | Search (title/url/tags) + tag-click filter + count | `logic.filterBookmarks`; `app.js` visible()/render() |
| SCN-004 | Read-later opt-in + read/unread + views + badge | `server.js` PATCH(readLater/read); `logic.unreadCount`; `app.js` buildStatus()/views |
| SCN-005 | Empty states, failed-title fallback, invalid rejected | `server.js` POST (400 / titleFailed); `app.js` emptyMessage()/showErr |
| SCN-006 | Duplicate → take to existing, open for edit | `logic.findDuplicate`; `server.js` POST 409; `app.js` handleDuplicate() |
| SCN-007 | Delete with confirm; disappears everywhere | `server.js` DELETE; `app.js` confirmdel/remove() |
| SCN-008 | Long text wraps; persistence across sessions | `style.css` word-break; `store.js` load/save |

## Dropped alternatives

- **SQLite / external DB:** unnecessary for a single-user local app; JSON file
  meets the persistence requirement with less setup. Revisit if multi-user or
  large scale is requested (see non-functional backlog).
- **Client-side title fetch:** blocked by browser CORS; done server-side.
- **Truncating long titles with ellipsis:** rejected by client in SCN-008;
  wrapping chosen.

## Tests

- `test/logic.test.js` — unit tests of pure logic.
- `test/api.test.js` — API integration against each happy/edge scenario.
- `test/persistence.test.js` — data survives a simulated restart (SCN-008).
Run with `npm test` (Node built-in test runner; no network needed).
