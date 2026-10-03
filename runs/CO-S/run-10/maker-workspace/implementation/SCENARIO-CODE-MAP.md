# Scenario → code map (cycle 1)

Maps each approved scenario to the code that implements it and the tests that
cover it. Basis for impact analysis on future change requests.

| Scenario | Implementation | Tests |
|---|---|---|
| SCN-001 Save with auto-filled details, newest first | `src/bookmarks.js` `create()`; `src/metadata.js` `fetchMetadata/parseMetadata`; `src/store.js` `list()` (newest-first + id tiebreak); client `save()`, `renderItem()` in `public/app.js` | unit: "create saves…newest first", "parseMetadata…"; e2e: SCN-001 |
| SCN-002 Find a link by searching | `public/lib.js` `matchesQuery/haystack`; client `render()` filter + `highlight()` | unit: "matchesQuery…"; e2e: SCN-002 |
| SCN-003 Tags with reuse suggestions | `public/lib.js` `normalizeTag/normalizeTags`; client `suggestions()`, `renderSuggest()`, chip handling in `wireItems()` | unit: "normalizeTags…", "update normalizes tags…"; e2e: SCN-003/004/009 |
| SCN-004 Note with basic formatting | client `renderNote()`; service `update()` note trim | unit: "update…trims trailing note…"; e2e: SCN-003/004/009 |
| SCN-005 Read later + tabs + search-in-tab | `public/lib.js` `inView`; service `update({toRead})`; client tabs + `data-toread` | unit: "inView…", "read-later toggles…"; e2e: SCN-005 |
| SCN-006 Archive / restore; clears read-later | service `update({archived})` (clears toRead); `inView`; client `data-archive/data-restore` | unit: "read-later toggles; archiving clears…", "inView…"; e2e: SCN-006 (both) |
| SCN-007 Delete permanently with confirmation | service `remove()`; client inline confirm (`data-delete/-confirm/-cancel`) | unit: "remove deletes permanently"; e2e: SCN-007 |
| SCN-008 Duplicate prevention | `public/lib.js` `normalizeUrl`; service `create()` duplicate branch; server 409; client `save()` 409 handling + `statusAction` | unit: "normalizeUrl…", "create prevents duplicates…", "duplicate of an archived link…"; e2e: SCN-008 (both) |
| SCN-009 Edit title/description in one editor; blank→address | service `update({title,description,…})` with host fallback; client `editorHtml()`, `state.draft`, `syncDrafts()` | unit: "update edits title/description…"; e2e: SCN-003/004/009, "clearing the title falls back…" |
| SCN-010 Missing data & invalid input | `public/lib.js` `isValidUrl`, `deriveFallbackMeta`; service `create()` invalid/fallback; client welcome / no-results / empty-tab states | unit: "isValidUrl…", "create rejects invalid…", "create still saves when details can't be fetched", "deriveFallbackMeta…", "fetchMetadata falls back…"; e2e: SCN-010 (invalid, welcome) |

## Non-functional (context/non-functional-backlog.md)
- NF-1 quick save, NF-2 responsive (fluid single-column, mobile viewport meta),
  NF-3 long-text wrapping, NF-4 relative saved-time — not yet formally addressed;
  layout is responsive and save is a single request.

## Key files
- `server.js` — HTTP API + static hosting; `createApp()` exported for tests.
- `src/store.js` — JSON persistence (`Store`).
- `src/bookmarks.js` — business rules (`BookmarkService`).
- `src/metadata.js` — page-details fetch + fallback.
- `public/lib.js` — shared pure logic.
- `public/{index.html,styles.css,app.js}` — web client.
- `test/unit.test.js` — logic/service tests (`npm test`).
- `test/acceptance.spec.js` — Gherkin-mapped e2e (`npm run test:e2e`).
