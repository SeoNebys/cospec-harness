# Design-decision record (Phase 2, Cycle 1)

Lightweight record of what was decided, why, and dropped alternatives — enough for
impact analysis and to regenerate formal docs on request.

## DD-1 — Client-only web app, local storage
- Decision: v1 is a single-page web app that runs in the desktop browser and stores
  all bookmarks locally (browser localStorage), no server/account.
- Why: goal is single-user, "sitting at my desk" (goals.md); no sharing, no multi-device
  requirement stated. Keeps v1 shippable and private by default.
- Dropped: cloud backend / accounts (unnecessary for stated scope; revisit if
  multi-device is ever requested).
- Impact: persistence lives in store.js; swapping to a backend later is isolated there.

## DD-2 — Page reader is an abstraction (pageReader.js)
- Decision: reading a page's title/description/thumbnail is behind readPage(url).
  In a pure browser app, arbitrary cross-site fetch is blocked by CORS, so v1's reader:
  favicon via a public favicon service (works as an <img>), title derived from the URL,
  description empty, thumbnail -> placeholder tile.
- Why: keeps the app fully working offline/standalone and honest to SCN-014's graceful
  degradation (auto-fill may fail; saving always works; user can fill in).
- Production path (noted): a tiny serverless proxy that fetches OpenGraph/meta for real
  titles/descriptions/thumbnails; drop-in behind readPage().
- Related: SCN-001, SCN-013, SCN-014.

## DD-3 — URL normalization for "same link?" (store.js: normalizeUrl)
- Decision: normalize protocol, leading www, trailing slash, case; strip a maintained
  denylist of tracking params; KEEP all other query params.
- Why: SCN-007 — ignore tracking gunk, respect meaningful query (v=, page=, q=).
- Related: SCN-007, SCN-016 (dedupe on import).

## DD-4 — Read/unread and set-aside are per-bookmark flags, not folders
- unread (to-read) and archived (set aside) are booleans on each bookmark.
- Main list = not archived. To-read pile = not archived AND unread. Set-aside = archived.
- New save: unread=true (SCN-011). Import default: unread=false except Read-Later folder
  (SCN-016).
- Related: SCN-009, SCN-011, SCN-016.

## DD-5 — Labels are canonical strings, first-spelling-wins
- A global label registry keeps the first-created spelling; matching is case-insensitive.
- Store.resolveLabels() canonicalizes AND dedupes a label list within one bookmark
  (added in Phase 3 to fix a duplicate-label bug; see verification-cycle1.md).
- Related: SCN-002.

## DD-6 — Clamping is CSS-only; model always holds full text
- Card truncation via CSS line-clamp/ellipsis; the stored title/description/note are
  never shortened; editor shows full text.
- Related: SCN-015.

## DD-7 — Filtering is a pure function (store.js: applyFilter)
- include(Set)+mode(all/any)+exclude(Set)+query -> filtered list; used by list, search,
  saved views. Pure and unit-tested.
- Related: SCN-003, SCN-010, SCN-017.

## DD-9 — Keep-a-copy behind a capture abstraction (capture.js)  [Cycle 3, SCN-018]
- Decision: bookmark.copy = {status:'kept',body,images}|{status:'none'}|{status:'pending'}.
  capturePage(url) is the abstraction; production = the blessed server piece that fetches
  + extracts readable content (shared plumbing with real auto-fill metadata, DD-2).
  Client build: DEMO hosts return real readable text; others honestly return 'none'
  (never fabricates content) -> "no copy" marker + note kept + archive fallback (flavour C).
- Capture fires quietly at save (new saves) and lazily on first view (imports).
- Search: copy text joins matchesQuery; copyMatchSnippet() gives the "why matched" snippet
  when a term is only in the copy. Flavour B (pixel snapshot) deferred; P4 dead-detect deferred.
- Related: SCN-018, SCN-001, SCN-003/005.

## DD-8 — Undo is a single-slot action stack
- Reversible actions (delete, set-aside, mark read/to-read, bulk ops) push an undo
  closure shown in a toast for a few seconds. Bulk delete additionally confirms first.
- Related: SCN-008, SCN-009, SCN-011, SCN-012.
