# Design-decision record — Cycle 1

Lightweight record to enable later-cycle impact analysis and, if requested,
generation of traditional design/test artifacts.

## Architecture
- **Single-user, no sign-in, persistent** (client-confirmed scope). One shared
  collection stored on the server.
- **Backend:** Node.js + Express (`server.js`, `src/`). REST API over JSON.
- **Persistence:** a single JSON file (`src/store.js`, default
  `data/bookmarks.json`). Chosen over a database because the scope is a private
  single-user collection; keeps zero external services and preserves the
  lockfile-light footprint. `Store` is swappable behind its method surface if a
  DB is needed later.
- **Frontend:** static HTML/CSS + ES modules (`public/`). Rendering is a single
  `render()` over the in-memory list fetched from the API; mutations re-fetch to
  stay consistent (fine for single-user).
- **Details fetch:** `src/metadata.js` fetches the page and extracts
  og:title/`<title>`, og:description/meta description, og:site_name/host. A
  failure throws and the API returns `{ok:false}`, driving the "couldn't get
  details, save anyway" behaviour.

## Notable decisions / alternatives dropped
- **Search runs client-side** over the loaded collection (`public/js/search.js`),
  a recursive-descent parser producing a predicate. Alternative (server-side
  search) dropped: unnecessary for a personal collection and this keeps live
  typing instant. The parser is a standalone ES module so it is unit-testable in
  Node and reused unchanged in the browser.
- **Duplicate matching** (`public/js/urlkey.js`) normalises protocol, `www.`,
  trailing slash, and host case. Detection happens client-side at save time
  (matches approved SCN-002); the API create endpoint stays permissive.
- **Delete confirmation is inline** (two-step on the card), not a modal
  (client-confirmed).
- **Address rendered as a link** (`target="_blank" rel="noopener"`): treated as
  the self-evident representation of "the saved address", not new behaviour.
- **Test-only reset endpoint** (`/api/_test/reset`) is gated behind
  `ALLOW_TEST_RESET=1` and never enabled in the review/production start command.

## Non-functional items deferred (see context/non-functional-backlog.md)
- NFR-001 responsive/mobile layout, NFR-002 long-content wrapping (partially
  handled via CSS `word-break`/`overflow-wrap`), NFR-003 large-collection
  performance.
