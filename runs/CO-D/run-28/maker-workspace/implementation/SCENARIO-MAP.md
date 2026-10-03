# Scenario → code mapping (Cycle 1)

Basis for later-cycle impact analysis. Files are under implementation/.

| Scenario | Behaviour | Code |
|----------|-----------|------|
| SCN-001 | Quick save, in-place review, confirm | public/app.js `startAdd`, `draftFields`; server `POST /api/bookmarks`; lib/store.js `create` |
| SCN-002 | Item display, separate note, edit anytime | public/app.js `renderItem`, `renderNote`, `openEditor`; styles item layout |
| SCN-003 | Case-insensitive search across fields | lib/search.js `haystack`,`parseQuery`; app.js search handler, `hl` |
| SCN-004 | Tags: add w/ suggestions, filter match-all | app.js `tagEditor`, `renderFilters`, `matches`; store `normTags` |
| SCN-005 | #tag, phrases, AND/OR/NOT, parentheses, incomplete flagged | lib/search.js `tokenize`,`parseQuery`,`termsFromQuery`; app.js searcherr |
| SCN-006 | Read later + To read view | app.js `inView`,`renderViews`, star action; store `update` |
| SCN-007 | Archive hidden from All/To read; Archived view | app.js `inView`,`renderViews`, arch action |
| SCN-008 | Re-save opens existing, no duplicate | lib/normalize.js `dupKey`; store `create` (duplicate); app.js `revealExisting` |
| SCN-009 | Save works when lookup fails | lib/metadata.js `collectMetadata` fallback; app.js `startAdd` failed branch |
| SCN-010 | Empty states per view / no matches | app.js `render` empty branch |
| SCN-011 | Empty/invalid address rejected | lib/normalize.js `normalizeUrl`; store `create` invalid-url; app.js validation |
| SCN-012 | Near-duplicate normalisation, prefer https | lib/normalize.js `dupKey`,`preferHttps`; store `create` |
| SCN-013 | Sort + default vs temporary | app.js `sortShown`,`refreshSortNote`,`openSettings`; store settings |
| SCN-014 | Permanent delete w/ confirm, separate | app.js `confirmDelete`; server `DELETE`; store `remove` |
| SCN-015 | Edit address, validation + uniqueness | store `update` (address-conflict); app.js `openEditor` |
| SCN-016 | Bulk select + actions, keep/clear rule | app.js `renderBulkBar`,`doBulk`; server `POST /api/bookmarks/bulk` |
| SCN-017 | Live saved collections | app.js `renderCollections`,`applyCollection`; server collections routes; store collections |
| SCN-018 | Local copy / PDF / Internet Archive | lib/metadata.js `saveSnapshot`,`createArchive`; server snapshot/archive routes; app.js `renderCopies` |
| SCN-019 | Import/export standard bookmarks HTML | lib/bookmarks-html.js; server `/api/export`,`/api/import`; app.js settings import/export |
| SCN-020 | Text size + per-page + Previous/Next paging | app.js `render` paging, `applyFontSize`,`openSettings`; styles fs-* |
| SCN-021 | Real favicon w/ fallback + preview where available | lib/metadata.js `collectMetadata`; store `fallbackFavicon`; app.js `renderItem` favicon/preview |

## External-service note
SCN-018 (snapshot, archive.org) and SCN-021 (favicon/preview fetch) perform real
network I/O server-side and degrade honestly when offline. Acceptance tests that
require outbound network are marked and may be skipped in an offline sandbox; the
degradation paths are covered by unit/integration tests with stubs.
