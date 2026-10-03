# Design decisions (cycle 1)

Lightweight record of what was decided, why, and what was dropped. Enough to
re-orient after a context reset and to support impact analysis in later cycles.

## DD-1 — Architecture: small Node server + browser client + shared pure module
- **Decision:** Express server exposing a JSON API and serving a static
  vanilla-JS client. Pure, side-effect-free logic lives in `public/lib.js` and is
  imported by the server, the browser client, and the unit tests (one source of
  truth).
- **Why:** Meets "one place to save/find links" with real persistence, while
  keeping the stack simple and fully testable. Sharing `lib.js` avoids duplicating
  URL/search rules between client and server.
- **Dropped:** A front-end framework (React/Vue) — unnecessary for this scope and
  would add a build step.

## DD-2 — Persistence: JSON file store with atomic writes
- **Decision:** `src/store.js` persists all bookmarks to a JSON file, writing to a
  temp file then renaming (atomic replace). All access is funnelled through the
  `Store` class.
- **Why:** Pure-JS, no native build (unlike `better-sqlite3`) and no experimental
  flags (unlike `node:sqlite`). Adequate and reliable for a single-user personal
  tool.
- **Dropped:** SQLite — deferred to a later cycle if scale/query needs grow. The
  `Store` interface isolates callers so the engine can be swapped without touching
  business logic.

## DD-3 — Automatic details: real fetch with graceful fallback
- **Decision:** On save, `src/metadata.js` fetches the page (4s timeout, HTML only,
  first ~512KB / up to `</head>`) and extracts og:title / <title>, description,
  og:site_name via targeted scans. Any failure returns an address-derived fallback.
- **Why:** Satisfies SCN-001 (details filled automatically) and SCN-010 (link is
  saved even when details can't be fetched — "never lose it" wins).
- **Dropped:** A full HTML parser dependency — a targeted scan of the head is
  enough for title/description/site name. Favicon fetching — replaced by a simple
  initial-letter avatar to avoid extra network calls (matches approved prototype).

## DD-4 — Search & view filtering happen client-side
- **Decision:** The client holds the current list in memory and filters live for
  search and tabs (`matchesQuery`, `inView` from `lib.js`); mutations go to the API
  and then re-read the list.
- **Why:** Instant live search (SCN-002) and tab switching (SCN-005/006) for a
  personal-scale collection, with the server authoritative for data and dedupe.
- **Later cycle note:** If collections grow very large, move search server-side
  (the pure `matchesQuery` can be reused there).

## DD-5 — Duplicate detection by normalised URL
- **Decision:** `normalizeUrl` (lower-cased host without `www.`, path without a
  trailing slash, plus query) is the dedupe key, stored as `urlKey`. POST returns
  409 with the existing bookmark and its archived flag (SCN-008).
- **Why:** Prevents duplicates working against findability; treats trivially
  different forms of the same address as one.

## DD-6 — Editor drafts held in state, not re-read from the DOM
- **Decision:** While editing, title/description/note/tags live in `state.draft`;
  tag add/remove re-renders from the draft, and text inputs sync into the draft
  before any re-render.
- **Why:** Fixes the class of bug where editing tags would discard unsaved
  title/description/note text (found during Phase 1 and re-verified by tests).

## DD-7 — Deletion guarded by inline confirmation
- **Decision:** Delete shows an inline confirm row (not a native dialog) before
  permanently removing (SCN-007).
- **Why:** Reversible-feeling UI, testable, and distinct from archive (recoverable).
