# Design-decision record — Cycle 1

Lightweight record of what was decided and why, to support later-cycle impact
analysis. Behaviour basis: approved scenarios SCN-001..009 (see /work/context).

## Architecture

- **Dependency-free Node (built-in `http`) server** in `server.js` + `src/app.js`.
  Chosen to guarantee a reliable start with no install step in the review
  environment. Alternative (Express) dropped to avoid a runtime dependency.
- **Single-page vanilla-JS front end** in `public/` (`index.html`, `styles.css`,
  `app.js`). No build step. Alternative (a framework/bundler) dropped as
  unnecessary for one screen and to keep start-up trivial.
- **JSON-file storage** (`src/store.js`, `data/links.json`). Single personal user,
  so a file is enough and keeps the collection durable across restarts. A database
  was not prescribed; can be swapped later if scale demands (NF backlog).
- **Shared domain logic** in `public/logic.js` (ES module), imported by both the
  browser and the server/tests, so search/tag/ordering rules have one definition.

## Key behavioural decisions

- **Auto page-info fetch is server-side** (`src/pageinfo.js`) — avoids browser CORS
  limits, reads `<title>`/`og:title` and `meta description`/`og:description`.
  Injected as `fetchInfo` so tests are deterministic without network.
- **Fetch failure never blocks saving (SCN-006):** on failure the link is stored
  with `autoFailed:true`, the UI shows the address as the title, a non-blocking
  notice, and affordances to add a title (and optional description) by hand.
- **Duplicate detection (SCN-008)** compares `normalizeUrl` (scheme-normalised,
  `www.`/case/trailing-slash-insensitive). Server responds 409 with the existing
  link; the client jumps to and flashes it. No second copy is created.
- **Plausible-URL guard (SCN-008):** `isPlausibleUrl` requires a dotted domain;
  plain text is rejected (400) and the typed text is preserved for correction.
- **Icon** is a deterministic coloured letter tile from the host (reliable,
  offline-safe); a blank/neutral tile when auto-fill failed and no title yet.
- **Reading list is opt-in (SCN-003):** a boolean `inList` per link, not a global
  read/unread status. "Done" sets `inList:false` and never deletes.
- **Search & filtering are client-side** over the loaded collection for instant
  feedback; the server only stores. Newest-first ordering everywhere (SCN-009).
- **Removal (SCN-007)** requires an inline confirm; then DELETE removes permanently
  (no trash/undo this cycle).

## Deferred (non-functional backlog / later cycles)

Large-collection performance & paging, multi-device sync, export/backup, editing
auto-filled fields on any link, reading-list ordering. See
`/work/context/non-functional-backlog.md`.
