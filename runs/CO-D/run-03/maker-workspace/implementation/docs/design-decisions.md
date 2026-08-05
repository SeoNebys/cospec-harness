# Design decisions

Lightweight record of what was decided and why, for impact analysis in later cycles.

## Architecture
- **Local web app = Node backend + browser front-end.** The approved behaviours
  need work a browser cannot do alone: fetching a page to auto-capture its
  title/image/summary, keeping a readable copy, checking if a link is alive, and
  parsing an imported bookmarks file. A small local server handles those; the
  browser handles the interface we refined in Phase 1.
- **Rejected:** a pure browser-only app (blocked by cross-site fetch limits — no
  auto-capture, no saved copies, no liveness checks). Also rejected a browser
  extension (heavier to install; the client pictured a plain web app).

## Storage
- **Plain JSON file (`data/db.json`), copies stored inline as text.** Single
  user, modest scale (hundreds–low thousands). No database dependency, trivially
  portable, and it makes the "export everything / not locked in" promise (SCN-020)
  almost free. Readable copies are kept as extracted plain text (paragraphs),
  matching the approved reader view and avoiding running saved page scripts.
- **Rejected:** SQLite (native build friction in some environments) — not worth
  it at this scale. Revisit if the collection grows very large.

## Capture (`capture.js`)
- Fetch with a timeout; parse with jsdom; extract readable content with
  Mozilla Readability (falls back to body text). Metadata from Open Graph →
  Twitter → `<title>`/`<meta description>`.
- Extraction (`captureFromHtml`) is separated from fetching (`capture`) so the
  service can inject a fake capturer in tests — no network in the test suite.

## Search (`search.js`)
- Field weights title/summary/labels(100/40/40) > url(20) > body(10) implement
  "obvious matches first, buried-in-body after" (SCN-016). Multi-word = AND of
  groups, each group an OR set; a term may match any field (loose, no adjacency).
- One quotes rule does double duty: exact phrase AND the literal-word escape
  (SCN-017). "not"/"without"/"except" and a leading "-" are exclusions; bare
  "and" is ignored (AND is the default); bare "or" builds an either-group.
- Runs server-side because the body text lives on the server; the client renders
  the ranked results, the "why it matched" chips, and the snippet.

## Status model
- `unread` (to-read, SCN-010) and `archived` (SCN-008) are separate booleans,
  deliberately NOT topic labels — the client's own status-vs-topic distinction.
- Archived is excluded from everyday list, to-read, label groups, and search;
  visible only in the Archived view (SCN-008, confirmed integrated in SCN-018).

## Delete (SCN-006)
- Soft-delete with a purge timer (~12s) gives a real Undo window without losing
  the copy/labels; a background sweep hard-purges after the window.

## Import (SCN-020)
- Runs as an async job with progress polling (`/api/import/:jobId`) so large
  piles show progress and can run in the background.
- Netscape bookmarks HTML and this app's own JSON export are both accepted (the
  latter for lossless round-trips). Folders → lowercased labels (nested → one
  label each). Original `ADD_DATE` preserved as `savedAt` so history survives and
  newest-first is meaningful. Duplicates skipped (existing + within-file). A page
  already dead on arrival is imported honestly: title/date kept, no copy,
  `originalGone` flagged, counted separately — never shown as saved-and-safe.

## Front-end
- Server-driven rendering: state is {view, label, query}; every change re-fetches
  from the API and re-renders. Editing is a local overlay that does not re-fetch
  until commit/cancel, so in-progress edits are never clobbered.

## Deferred (next cycle, out of this build)
- SCN-019 saved searches, SCN-021 ordering options, SCN-022 batch actions.
  Note: the store already keeps `savedAt` and defaults to newest-first, so
  ordering options (SCN-021) will be a small addition.
