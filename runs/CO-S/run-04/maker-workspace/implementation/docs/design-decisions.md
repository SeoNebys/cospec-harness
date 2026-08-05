# Design decisions (cycle 1)

Notes for understanding the structure after a context reset, and the basis for
later impact analysis.

## DD-1: Small local web server, not a client-only page
- **Decision:** A tiny Node HTTP server serves the page and exposes a JSON API.
- **Why:** Automatic page-name lookup (SCN-001/006) requires fetching another
  site's HTML and reading its `<title>`. A browser cannot do this for arbitrary
  sites (cross-origin restrictions). The lookup must run server-side.
- **Dropped alternatives:**
  - Pure static page + `localStorage`: cannot do reliable title lookup; rejected.
  - Public CORS proxy from the browser: unreliable / privacy-leaking; rejected.

## DD-2: Zero runtime dependencies
- **Decision:** Built on Node's built-in `http`, `fs`, `crypto`; no npm installs.
- **Why:** The client runs this on their own computer; "nothing to install"
  lowers friction and avoids supply-chain/version risk. Node 18+ has global
  `fetch` and a built-in test runner, which is all we need.

## DD-3: JSON file storage with atomic writes
- **Decision:** Bookmarks live in one JSON file, mirrored from an in-memory
  array; every change writes to a temp file then `rename`s over the real one.
- **Why:** Satisfies persistence (SCN-009) simply and durably for single-device
  use. Atomic rename means a crash mid-write cannot truncate/lose the file. A
  corrupt file is surfaced as an error rather than silently wiped (never lose
  the user's links).
- **Dropped alternatives:** SQLite (needs native build; overkill for one user).

## DD-4: Order in the array is the display order
- **Decision:** Newest-first; `add` unshifts, `restore` splices at a saved index.
- **Why:** Matches SCN-001 (newest on top) and SCN-004 (undo restores the item
  to its exact previous position).

## DD-5: Optimistic "getting the page name…" on the client
- **Decision:** On save, the client shows a pending row immediately, then the
  POST response (which already includes the resolved or fallback name) replaces
  it.
- **Why:** Gives the approved brief "looking up the name" moment (SCN-001)
  without a second round-trip or polling. The API stays synchronous and easy to
  test.

## DD-6: `nameStatus` field drives the fallback nudge
- **Decision:** Each bookmark carries `nameStatus`: `found` | `fallback` |
  `custom`. The client shows the "name not found — rename?" nudge only for
  `fallback`; renaming sets `custom`, clearing the nudge.
- **Why:** Directly encodes SCN-006 behaviour in data the UI can read.

## DD-7: Duplicate detection is server-side and normalised
- **Decision:** The server checks for an existing link by normalised URL (drop
  scheme, trailing slash, case) before creating one (SCN-008). Duplicates return
  `200 {duplicate:true, bookmark}` so the client can flash the existing entry.
- **Why:** The store is the source of truth; the client cannot be trusted to
  know the whole list during optimistic rendering.

## DD-8: "Not a link" warning is client-side and soft
- **Decision:** The client applies the `looksLikeUrl` heuristic and shows the
  "save anyway / cancel" warning (SCN-007). The server will still save whatever
  it is sent (title lookup then just falls back).
- **Why:** The warning is a UX guard, not a validation rule; the server must
  remain permissive so "Save anyway" always works.

## DD-9: Search is client-side
- **Decision:** Live filtering, name+address matching, and highlighting
  (SCN-003) run entirely in the browser over the already-loaded list.
- **Why:** The whole list is small (single-user) and already in memory; instant
  filtering with no round-trip is the approved feel. Revisit if NF-2 (very large
  libraries) is promoted.
