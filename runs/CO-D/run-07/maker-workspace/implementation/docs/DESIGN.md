# Design-decision record — My Bookmarks (cycle 1)

Lightweight record to enable later-cycle impact analysis and, if asked, to
generate traditional design docs.

## Architecture
- **Runtime:** Node.js 24 built-in `http` server (`server.js`). No web framework
  — keeps the dependency surface and lockfile minimal (guidance allows any
  compatible deps; none needed at runtime). Playwright 1.61.0 is a dev-only tool
  (linked from the shared image, pinned to match the installed browsers).
- **Frontend:** vanilla ES-module SPA in `public/` (`index.html`, `app.js`,
  `styles.css`). Talks to a small JSON API. Written fresh from the approved
  scenarios — Phase-1 prototype code was NOT reused (per method prohibition).
- **Shared pure logic:** `src/query.js` (search language) and `src/normalize.js`
  (link rules) are dependency-free ESM, used by the server AND served to the
  browser at `/lib/*` so the search/normalise semantics are defined once.

## Storage (NFR-003)
- File-backed JSON store (`src/store.js`, `data/store.json`), per-account.
- Accounts are keyed by an HTTP-only session cookie (`bmsid`); a browser gets a
  persistent account with working cookies in the review environment. Single
  review account per cookie now; the shape (`accounts{}`) allows real multi-user
  auth later. Chosen over a DB to avoid native build/network for this trial;
  swap-in of SQLite/Postgres is isolated to `store.js`.

## Page details & preserved copies (NFR-004, NFR-005)
- `src/metadata.js` fetches the live page and parses title/description/og:image/
  favicon, with a fast fallback (SCN-008) deriving a title from the URL when the
  page can't be read (`autofilled:false`).
- `src/preserve.js` stores a snapshot: HTML with a `<base>` + "preserved copy"
  banner, or the PDF bytes for PDF links. Served back at `/copy/:id`. Real
  byte-perfect self-containment (asset inlining) is deferred (NFR-005); the
  current copy renders and is clearly marked.
- **Auto-copy is non-blocking:** the save responds immediately and the snapshot
  is captured in the background; the client polls the single bookmark
  (`GET /api/bookmarks/:id`) until the copy appears. This protects the core value
  "saving stays effortless" (SCN-001) while honouring "automatic copies"
  (SCN-015). Manual "Save a copy" awaits and returns the copy directly.
- `src/net.js` centralises fetch with a 5s timeout and an SSRF guard (blocks
  localhost/private ranges; relaxed only when `BM_ALLOW_LOCAL=1` for tests).

## Internet Archive (SCN-015)
- Explicit action only. `toInternetArchive` best-effort calls Save-Page-Now and
  otherwise returns a timestamped wayback URL. Never automatic.

## Search (SCN-005)
- Recursive-descent parser in `src/query.js`; precedence NOT > AND > OR,
  parentheses, adjacency = AND, `#tag` exact, `"phrase"` literal, quoted
  operators literal, case-insensitive. Malformed → plain-substring fallback with
  a non-blocking notice.

## Import/Export (SCN-016)
- `src/bookmarks.js` parses the Netscape format (folders→tags, ADD_DATE kept,
  dedup by the same-link rule) and builds a standard, interoperable export that
  also carries STATUS/ARCHIVED/notes for lossless re-import.

## Key UX decisions (carried from approved scenarios)
- One shared edit screen for save-preview and later editing (SCN-002).
- Per-card: Edit + status visible; Archive/Delete/copies under "More" (SCN-011).
- Duplicate on save OR address-edit → open existing (SCN-003/011).
- Archive is a separate dimension from read status, reached via a distinct link
  (SCN-012). Bulk work is a deliberate "Select" mode (SCN-013).
- Preferences (sort, autoCopy, pageSize, textSize) persisted server-side per
  account (SCN-010/017).

## Dropped alternatives (explored in Phase 1)
- Correction: inline/tap-to-edit (chose shared preview+Edit).
- Duplicate: notice-and-jump (chose open-existing-edit).
- Tag entry: comma / plain chips (chose chips + reuse suggestions).
- Read view: tabs / two-sections (chose All/To-read/Finished switch).
- Action layout: all-buttons (chose Edit+status visible, rest under More).
- Archive UI: Active/Archived switch (chose separate link).
- Selection: always-on checkboxes (chose Select mode).
- Preserve timing: on-demand only (chose automatic default + off switch).

## Test/runtime notes
- `node_modules` is a symlink to the image's shared modules so ESM resolves
  `@playwright/test` (pinned 1.61.0) for acceptance tests. Runtime `npm start`
  needs no modules (built-ins only).
- Test-only affordances gated by `BM_TEST=1`: `/testpage/*`, `/api/reset`.
