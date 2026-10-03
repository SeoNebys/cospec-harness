# Design decisions — Link Library (Cycle 1)

Production implementation of the 15 approved scenarios (SCN-001..015). Built
fresh from the approved GWT; prototype code under `/work/prototypes` was NOT
reused.

## Architecture

- **Single-user, server-synced library.** Per NF-003/NF-004: one personal
  library + preferences, synced across the client's devices by living on the
  server. No sharing, no multi-user administration, no self-service account
  management. The server is the single source of truth; any device loads current
  state and mutations persist server-side.
- **Backend:** plain Node.js (24) `http` server, no runtime dependencies
  (keeps the lockfile trivial and avoids native builds). Responsibilities:
  serve the static single-page app, expose a small JSON API, and fetch real page
  metadata server-side.
- **Storage:** a JSON document (`data/store.json`) holding `{ links, preferences,
  savedViews }`, written atomically (temp file + rename). Sufficient for a
  personal library; swappable later.
- **Frontend:** vanilla-JS single-page app in `public/`. Loads the whole library
  once and does filtering / search / sort / pagination client-side (a personal
  library is small enough), matching the approved behaviour. Mutations call the
  API and update local state.
- **Metadata fetch:** `POST /api/metadata` fetches the URL server-side (global
  `fetch`, timeout) and extracts title/description/site/image/favicon. On any
  failure or unreachable page it returns `{ ok:false }`, and the client opens the
  review panel with empty fields for manual entry (SCN-002 fetch-failure branch,
  reaffirmed by the client for the build).

## Key rules carried from the approved scenarios

- Address normalisation: shorthand (`nytimes.com`) → `https://nytimes.com/`;
  malformed input refused; a saved link always opens its original address.
- Reading model: `toRead` boolean; Reference = not toRead. Reading (mark read)
  clears the flag; everything stays in the one library. (SCN-006)
- Search grammar: implicit-AND words, `"phrase"`, `#tag`, case-insensitive
  `and/or/not`, parentheses; quotes force literal. Fields: title, description,
  address, note; tags via `#tag`. (SCN-008)
- Tags: include/exclude filters; reuse suggestions; saved views store
  search+include+exclude, evaluated live, reset to All on apply. (SCN-007,013)
- Archive vs delete: archive tidies away (kept); delete only from Archived, with
  confirmation; bulk delete likewise. (SCN-010, SCN-012)
- Sort: newest/recently-updated/oldest/title; "updated" bumped by edits, read
  changes, archive/restore. Session sort ≠ saved default. (SCN-011, SCN-015)
- Preferences: default order, links-per-page (Show more), text size; persisted
  server-side (synced). (SCN-015)

## Out of scope this cycle (recorded LATER-002)

Preserved page copies (self-contained HTML / stored PDF) and Internet Archive
submission. Not implemented; no non-functional buttons shipped.

## HTTP delivery

Server listens on `0.0.0.0:4000`; started with `npm start`. Review marker
`data-harness-ready="true"` set once the library UI + data have loaded.
