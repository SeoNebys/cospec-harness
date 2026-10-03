# Internal information system — Bookmarks app (Cycle 1)

Lightweight record to enable later-cycle impact analysis and, if requested,
generation of traditional design/test documents.

## Architecture overview

- **Runtime:** Node.js 24, Express. `type: module` (ESM throughout).
- **Server:** `server.js` boots a `BookmarkStore` and the Express app, listens on
  `0.0.0.0:4000` (`PORT`/`HOST`/`DATA_FILE` overridable via env).
- **App/API:** `src/app.js` (`createApp({store, fetchImpl})`) — factory so tests
  inject a store and a fake fetch. JSON REST under `/api`, static UI from `public/`.
- **Persistence:** `src/store.js` — JSON file (`data/bookmarks.json`) with atomic
  writes (temp file + rename), serialised. Single-user, survives restarts (NF-1).
- **Metadata:** `src/metadata.js` — fetches the page, extracts og:/`<title>` and
  description; degrades to a URL-derived fallback with `unreadable:true` on any
  failure. Injectable `fetchImpl`/`timeoutMs`.
- **Shared pure logic:** `public/js/shared.mjs` — validation, site/title
  derivation, search matching, view filtering, tab counts. Single source of truth
  imported by the browser UI, the server, and the tests (no duplication/drift).
- **Browser UI:** `public/js/app.mjs` + `index.html` + `css/styles.css`.
  Loads all bookmarks once and filters in-memory for instant search/browse;
  mutations go to the API and persist.

## Design decisions (what / why / dropped alternatives)

- **Client-side filtering, server-side persistence.** Instant search/tag/tab
  switching matches the approved UX; the dataset is a personal collection (small).
  Dropped: server-side query endpoints (adds latency/complexity for no benefit here).
- **JSON-file store over a database.** Zero external services, meets the only
  stated non-functional need (persistence). Dropped: SQLite/better-sqlite3
  (native build, unnecessary for single-user scale). Revisit if scale grows.
- **Shared ESM module for pure logic.** Same rules run in browser and Node tests,
  so acceptance and unit tests exercise the real logic. Dropped: duplicating
  logic in the browser bundle (drift risk).
- **Metadata fetch with graceful fallback, never throws.** A link is never lost
  (SCN-007); `unreadable` drives the on-card warning and the edit invitation.
- **Duplicate detection by exact URL.** Matches the approved behaviour; POST
  returns 409 + the existing bookmark so the UI can point to it.
- **New bookmark defaults:** `status:"to-read"`, `archived:false` (SCN-004).
- **Delete is a hard removal; archive is the reversible path** (SCN-005/009).
  Delete requires an explicit in-card confirmation distinct from archive.
- **Injected `fetchImpl` + offline fixture server** for deterministic, network-
  free acceptance tests.

## Scenario → code mapping

| SCN | Behaviour | Primary code | Tests |
|-----|-----------|--------------|-------|
| SCN-001 | Save + auto-fill, newest first | `app.js` POST, `metadata.js`, `store.add` | api.test, metadata.test, acceptance SCN-001 |
| SCN-002 | Tags + note (suggest/create) | `app.js` PATCH, `app.mjs` edit tag input | api.test, acceptance SCN-002 |
| SCN-003 | Search + tag browse + combine + highlight | `shared.mjs` matchesQuery/filterBookmarks, `app.mjs` hl/render | shared.test, acceptance SCN-003 |
| SCN-004 | Reading status + tabs + counts | `shared.mjs` filterBookmarks/tabCounts, `app.mjs` tabs, `app.js` PATCH status | shared.test, api.test, acceptance SCN-004 |
| SCN-005 | Archive / restore, excluded from everyday tabs | `shared.mjs` filterBookmarks, `app.mjs` archive/restore, `app.js` PATCH archived | shared.test, api.test, acceptance SCN-005 |
| SCN-006 | New-user empty state | `app.mjs` render (empty branch) | acceptance SCN-006 |
| SCN-007 | Save errors (malformed / unreadable / duplicate) | `app.js` POST, `metadata.js`, `shared.isValidHttpUrl` | api.test, metadata.test, acceptance SCN-007 |
| SCN-008 | Edit fields incl. address (validated) | `app.js` PATCH, `app.mjs` editCard/saveEdit | api.test, acceptance SCN-008 |
| SCN-009 | Permanent delete + confirmation | `app.js` DELETE, `app.mjs` confirmCard/deletePermanently | api.test, acceptance SCN-009 |

## Tests

- Unit/integration: `test/unit/*.test.js` (node:test) — 21 tests.
- Acceptance (Gherkin-driven, real UI): `test/acceptance/bookmarks.spec.js`
  (Playwright 1.61.0) — 11 tests, backed by `test/acceptance/fixture-server.js`.
- Run: `npm test` (unit) and `npm run test:acceptance` (Playwright).
