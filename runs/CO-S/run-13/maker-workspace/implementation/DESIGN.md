# Design-decision record — Bookmarks (cycle 1)

Production implementation of the 12 approved scenarios (SCN-001..012). Built fresh
from the approved GWT; no prototype code was reused.

## Architecture

- **Runtime:** Node.js 24, no web framework — a small `node:http` server
  (`server.js`) serving a static web client (`public/`) and a JSON API.
- **Persistence:** a single JSON file with atomic writes (`src/store.js`,
  `data/bookmarks.json`). Chosen for the goal "nothing gets lost" without adding a
  database dependency for a single-user app. Writes go to a temp file then
  `rename()` (atomic replace). Alternative dropped: SQLite (native build / newer
  `node:sqlite` experimental API) — unnecessary for one user and adds risk.
- **Search / filter / sort / tab views:** done client-side over the full list
  (`public/app.js`). Justified by single-user, modest data volume; keeps the API to
  simple CRUD. If the collection grew large this would move server-side.

## Key decisions

- **Metadata collection** (`src/metadata.js`): `parseMetadata(html, baseUrl)` is a
  pure function (regex extraction of `<title>`/og:title, description/og:description,
  og:image, og:site_name, `<link rel=icon>`; relative URLs resolved; favicon falls
  back to `/favicon.ico`). `fetchMetadata()` wraps it with a timed `fetch`. On any
  failure (network, timeout, non-2xx, non-HTML) it returns `{ok:false}` so the UI
  degrades to manual entry (SCN-010). Server-side fetch avoids browser CORS limits.
- **URL handling** (`src/url.js`): missing scheme → `https://`; validates real host
  (dotted, or `localhost`/IP); rejects bare words and non-http(s) schemes.
- **No duplicates** (SCN-009): duplicate detection by case-insensitive URL is
  enforced in the store on both create and address-edit. The API returns HTTP 409
  with the existing bookmark; the client navigates to it and opens it for editing.
- **Editing** (SCN-008): address is editable; when it changes, host/site follow and
  stale preview image / icon are cleared (a different page). Collisions blocked.
- **Favicon / preview rendering:** the client shows the real favicon / preview image
  when available and falls back (a coloured letter badge / "No preview" placeholder)
  when the image can't load — so it also works offline.
- **Test reset:** `POST /api/__test/reset` exists only when `ALLOW_TEST_RESET=1`
  (set by the Playwright config); never enabled in production.

## Data model (a bookmark)

`{ id, url, host, site, title, description, tags[], note, image|null, icon|null,
   savedAt, readLater, archived }`

## Running

- `npm start` → server on `0.0.0.0:4000` (`PORT`, `HOST`, `BOOKMARKS_DATA`
  overridable).
- `npm run test:unit` → node:test units. `npm run test:e2e` → Playwright acceptance.

## Traceability

See `../context/scenario-code-map.md` for scenario → code/test mapping.
