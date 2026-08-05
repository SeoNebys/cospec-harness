# Design-decision record — Bookmarks app (cycle 1)

Purpose: enough structure to (a) do impact analysis in later cycles and (b) regenerate
traditional design/test docs on request. Cycle 2's firm next item is page snapshots
(incl. keeping PDFs as real files) — the resolver/store seams below are where that lands.

## Interface form
A single-page web app opened in a browser on a laptop; no install. Data persists locally
(localStorage) so the client can just "pull it up." (Phone access = non-functional backlog.)

## Why this shape
- **Pure logic modules, DOM-free** (`js/model, labels, search, sort, importer, exporter,
  library`) — so the trust-critical rules (dedup, label case-merge, multi-word search,
  import mapping) are unit-tested independently of the UI. This is where correctness lives.
- **Browser-only modules** (`js/resolver`, `js/store`, `js/app`) — page-reading, persistence,
  and rendering. Isolated so the pure rules never depend on the environment.
- **`id = normalized URL`.** Dedup (SCN-002) is then structural: the same page can't occupy
  two ids. Normalisation drops `www.`, trailing slash, and tracking params; keeps
  page-selecting params. Used identically by paste-save and import.

## Key decisions & dropped alternatives
- **Title reading via `resolver.js` with graceful fallback (SCN-008).** Client-side `fetch`
  of arbitrary pages is often CORS-blocked; rather than depend on a backend now, the resolver
  tries best-effort and, on ANY failure, saves the link anyway with the address as a
  stand-in title + `needsName` flag. One quiet retry, then keep. A metadata proxy can be
  slotted in later behind the same interface. Dropped: mandatory backend (heavier; delays
  delivery) — deferred with snapshots to cycle 2.
- **Labels canonicalised case-insensitively** (`labels.js`). First-seen spelling wins; later
  variants (typed OR imported folders) reuse it. Kills "work"/"Work" and "recipe"/"recipes"
  splits (SCN-004, SCN-015). Dropped: forcing lowercase (loses the client's chosen casing).
- **Delete = remove + Undo toast; Put away = archived flag** (SCN-011/012). Two different
  intents, never the same control. Archived items are excluded from list, search, label
  piles, to-read — only visible in the "Put away" view.
- **Import shows a preview and commits nothing until confirmed** (SCN-015). Netscape parser
  is hand-rolled (no DOMParser) so it's testable in Node; container folders ("Bookmarks
  bar" etc.) are excluded from labels; nested folders yield BOTH levels; original ADD_DATE
  preserved for meaningful sort.
- **Export writes labels as folders + notes as `<DD>`** (SCN-016) so filing survives a move;
  round-trips back through import.
- **Search haystack = title + summary + site + note; multi-word = AND, quotes = phrase**
  (SCN-006, SCN-013). Highlighter returns segments (DOM-free) for testability.

## Data model (one bookmark)
`{ id, url, host, title, summary, note, labels[], toRead, read, archived, savedAt, needsName }`

## Files
- `js/model.js` normalisation, url parsing, fallback title
- `js/labels.js` case-insensitive label index
- `js/search.js` tokenize / matches / highlight-segments
- `js/sort.js` newest | oldest | a–z
- `js/library.js` pure ops: find-duplicate, visible-items(view)
- `js/importer.js` parse bookmarks HTML, plan import
- `js/exporter.js` build bookmarks HTML
- `js/resolver.js` (browser) page metadata + fallback
- `js/store.js` (browser) localStorage persistence + state ops
- `js/app.js` (browser) UI
- `tests/` node test harness over the pure modules
