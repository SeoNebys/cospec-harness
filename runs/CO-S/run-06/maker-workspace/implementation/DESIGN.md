# Design-decision record — Bookmark manager (Cycle 1)

Production implementation lives in `implementation/`. Built fresh from the
approved scenarios' behaviour (SCN-001..SCN-007); prototype code in
`prototypes/` was NOT reused (per project convention).

## Architecture
- **Node.js + Express** single service that serves a JSON API and the static
  frontend from one origin (`public/`). Chosen for zero build step and because
  the client wants a simple personal web app reachable in a browser.
- **File-backed JSON store** (`src/store.js`) rather than a database. Rationale:
  single-user personal tool; avoids a native dependency (e.g. better-sqlite3)
  and keeps the lockfile/toolchain simple. `Store(filePath)` persists to a JSON
  file; `Store(null)` is an in-memory store used by tests.
  - Alternative dropped: SQLite — unnecessary for one user; adds native build.
- **Metadata fetching** (`src/metadata.js`) does a real HTTP GET and parses
  `<title>` / `og:title` and `description` / `og:description`. `fetchImpl` is
  injectable so tests are deterministic without external network.
  - Alternative dropped: a headless browser for metadata — too heavy; static
    HTML parsing is sufficient for title/description.
- **Server-side filtering**: search + tag filter + view selection happen in the
  store and are exposed via query params. Rationale: keeps the behaviour
  testable at the API level and matches the approved scenarios precisely.

## Key behavioural decisions (traceable to scenarios)
- New bookmarks are inserted newest-first; not read-later; not archived (SCN-001,
  003, 004).
- Title falls back to the URL when none is provided, so a failed auto-fill never
  blocks saving and nothing is untitled (SCN-006).
- URL validity: parseable http/https with a dotted host; otherwise refused
  (SCN-006). A scheme-less host gets `https://` prepended.
- Duplicate detection normalises URLs (lowercase, strip trailing slashes)
  (SCN-007). Duplicates are reported both at metadata time (to warn early) and
  guarded at create time (409).
- Archived items are excluded from `all` and `later` views but remain in
  `archive` and searchable there; restore returns them and preserves their
  read-later flag (SCN-004).
- Editing updates in place, preserving id + later/archived state; no copy is
  made (SCN-007).

## Non-functional (backlog, not this cycle's functional scope)
- Responsive layout is implemented (mobile breakpoint in `styles.css`) but
  further phone polish is tracked as NF-1 for a later cycle.

## Runtime
- `src/server.js` listens on `0.0.0.0:4000` (configurable via env). Data file
  defaults to `implementation/data/bookmarks.json`.
