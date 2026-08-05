# Scenario → code map (Cycle 1)

Basis for impact analysis in later cycles. Updated as each slice lands.

## Slice 1 — core spine (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| SCN-001 save & recognise, newest-on-top | `extension/src/core.js` (makeLink, addToTop), `extension/background.js` (fetchMeta), `extension/library.js` (save/render), `extension/popup.js` | Title/desc from background fetch, or from the tab in the popup |
| SCN-002 open a saved link | `extension/library.js` (openLink → new tab), `core.js` (toFullUrl) | Whole card clickable; library stays put |
| SCN-003 duplicate handling | `core.js` (normalizeUrl, findDuplicate), `db.js` (findByNorm), `library.js` (flash + pulse + scroll), `popup.js` | No second copy; existing highlighted |
| SCN-004 unreadable fallback | `core.js` (makeLink unreadable, deriveFallbackTitle), `metadata.js` (ok flag), `library.js` (faded note card) | Saved anyway; rename later |
| SCN-022 non-URL input (guard) | `core.js` (isProbablyUrl), `library.js` (bad state + flash) | Full behaviour + search-offer lands with findability slice |
| DD-001 local-first storage | `extension/src/db.js` | IndexedDB, on the client's machine |
| DD-002 web reach via add-on | `extension/manifest.json`, `extension/background.js` | Option A confirmed by client |

### Spine feedback fixes (from client tyre-kicking, SESSION-001)
| Item | Where | Notes |
|------|-------|-------|
| Clear "Saved ✓" confirmation on the button | `extension/popup.js` (showSaved), `popup.html` (.done block) | Persistent green check, so no need to open library to trust it |
| YouTube (and similar) titles via oEmbed | `core.js` (oembedEndpoint), `background.js` (oEmbed-first fetch) | Real video title with no login; falls back to HTML parse |

## Slice 2 — edit, notes, labels (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| SCN-005 edit in a focused pop-up | `extension/library.js` (openEditor/saveEditor), `library.html` (dialog) | Name/Description/Web address; library dimmed, holds still |
| SCN-006 labels with suggestions | `core.js` (normalizeTag, addTag, suggestTags), `library.js` (renderTagSection, drawSuggest) | Chips + steer-to-existing suggestions + "create" |
| SCN-007 personal note | `library.js` (editor + card note), `library.html` (.note sticky style) | Kept distinct from the page description |
| SCN-019 note formatting (bold + bullets) | `core.js` (sanitizeNote), `library.js` (contenteditable + toolbar) | Only b/strong/ul/li/p/br kept; note-only |

Tests: `test/core-spine.test.js` + `test/slice2-and-fixes.test.js` — 14 passing.

### Slice 2 edge fix (client tyre-kick)
| SCN-003 edit back-door duplicate | `core.js` (findDuplicateElsewhere), `library.js` (saveEditor guard + .dwarn) | Editing an address into an existing one is blocked, no twin |

## Slice 3 — findability (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| SCN-009 search all fields, scraps/phrase, found-in | `extension/src/query.js` (parseTerms, matchesQuery, whereMatched, noteText), `library.js` (search box, hl highlight) | Live; note searched via stripped text; highlight on title/desc/url |
| SCN-008 topics stack (AND) + counts | `query.js` (filterByTopics, tagCounts), `library.js` (renderTopics) | Counts = whole-library totals |
| SCN-021 exclude a topic (explicit −) | `query.js` (filterByTopics excludes), `library.js` (minus btn, red/struck, active line) | Plain-language "showing X but not Y" |
| SCN-014 sort (4 orders, persists) | `query.js` (sortLinks), `library.js` (sortSel; state not reset by filters) | Date orders use savedAt |

Tests: `test/slice3-findability.test.js` added — 23 passing total.

### Slice 3 edge fix (client tyre-kick)
| Accent-insensitive search ("cafe"↔"café") | `query.js` (fold, used in matchesQuery/whereMatched) | Symmetric, so lazy typing never misses accented links |

## Slice 4 — read-later, tidy, delete, set-aside (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| SCN-010 read-later opt-in lens | `core.js` (makeLink status/aside, statusOf/isAside), `query.js` (poolForView, unread/asideCount), `library.js` (lens switch, flag) | Nothing auto-added; three states; shelved excluded from everyday + search |
| SCN-011 drain the pile (single + sweep, two exits) | `library.js` (statusControls toread, mutateOut, batch bar, Select-all) | ✓ Read vs "Not going to read"; bulk via checkboxes |
| SCN-012 bulk tidy + delete with undo | `library.js` (selectMode, batch: add-label/read-later/set-aside/delete; deleteIds+toast), `db.js` (deleteLink) | Delete behind ⋯; 6s Undo restores in place |
| SCN-013 set-aside shelf | `query.js` (poolForView aside), `library.js` (set aside / bring back; shelf lens) | Amber, out of everyday views + search |

Tests: `test/slice4-and-accents.test.js` added — 30 passing total.

## Slice 5 — saved searches (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| SCN-020 saved views (lens+topics+search, one-click, name/rename, remove) | `query.js` (savedViewKey), `db.js` (searches store v2, allSearches/putSearch/deleteSearch), `library.js` (renderSaved/applySaved/commitName) | Sort deliberately excluded from the bundle; save offered only when filtered & not already saved; remembers include AND exclude topics |

Tests: `test/slice5-saved.test.js` added — 33 passing total.
Note: DB bumped to v2 (adds `searches` store; existing links untouched).

## Slice 6a — saved copies + PDFs (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| SCN-016 auto saved copy, readable core, best-effort/partial, dead-page still opens | `src/reader.js` (extractReadable), `background.js` (captureCopy), `db.js` (copies store v3), `library.js` (copyRow, requestCapture, copyDone refresh), `viewer.html`/`viewer.js` | Auto on save; readable copy in a sandboxed frame; partial/failed labelled honestly |
| SCN-017 PDFs kept as the real file | `background.js` (pdf branch stores blob), `viewer.js` (blob in iframe) | The actual document, viewable |
| SCN-016 capture from the live tab (button) | `popup.js` (chrome.scripting → outerHTML → extractReadable) | Logged-in pages capture faithfully; falls back to background fetch |

Tests: `test/slice6-reader.test.js` — 37 passing total. DB → v3 (adds `copies`).
Note: capture happens at save time — links saved before this update have no copy
until re-saved (a "capture now" backfill is a possible later enhancement).

## Slice 6b — public archive, import/export, capture-now (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| SCN-016 capture-on-demand ("Keep a copy now" / "Refresh") | `library.js` (menuBtn data-capnow → requestCapture) | Rescues old/imported links; via background fetch (best-effort, no login) |
| SCN-017 opt-in public archive | `library.js` (openArchiveConfirm, per-card ⋯), `background.js` (publicArchive → web.archive.org/save) | First-time full explanation then light; per-link only; view link stored |
| SCN-015 import (preview, folders→labels, keep dates, skip dupes) | `src/porting.js` (parseBookmarksHtml, importDate), `library.js` (openImport/importPreview) | No auto-copy on import (by design) — capture-now rescues chosen ones |
| SCN-015 export (universal .html + full .json backup) | `src/porting.js` (buildNetscapeHtml, buildBackup), `db.js` (allCopies), `library.js` (openExport/download) | JSON carries links/searches/readable copies; PDF blobs omitted (noted) |

Tests: `test/slice6b-porting.test.js` (incl. export→import round-trip) — 42 total.
Non-functional (backlog): public-archive privacy honoured (opt-in, per-link,
explained). manifest: added `scripting` (live-tab capture for the popup).

## Slice 7 — comfort + finish (built)

| Scenario | Where | Notes |
|----------|-------|-------|
| Comfort knobs (exactly two): text size + light/dark | `src/settings.js` (zoomFor/normalize), `library.html` (dark + zoom CSS), `library.js` (openSettings, applyAppearance) | ⚙ Settings; live-apply; persisted in localStorage; spacing NOT a knob (default comfortable) |
| SCN-016 saved-copy on/off + per-link removal | `library.js` (keepCopiesOn gate in save; ⋯ "Remove saved copy"), `popup.js` (honours setting) | Global toggle in Settings; per-link "Remove saved copy" |
| Bulk "Keep a copy now" | `library.js` (batch bar `capnow`) | Rescue many imported/old links at once via Select |
| SCN-023 overflow already handled in card CSS (clamp+wrap) | `library.html` (.desc clamp, overflow-wrap, tags wrap) | Full text on open/edit |

Tests: `test/slice7-settings.test.js` — 46 passing total.

## Status
All approved scenarios (SCN-001..023) implemented across Slices 1–7, each with
acceptance-style tests (46 total, green) and the scenario→code map above.
Recorded later-cycle enhancements: edit-saved-view-in-place; capture-now backfill
(now partly served by bulk capture); in-PDF text search; note-formatting already
shipped. Ready for Phase 3 (verification) on the client's go.
