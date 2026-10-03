# Scenario-to-code mapping

| Scenarios | Production code | Tests |
|---|---|---|
| SCN-001, SCN-021, SCN-022 | `server.mjs` save endpoint; `lib/metadata.mjs`; save panel and fallback card in `public/app.js` | `metadata.test.mjs`; store validation tests |
| SCN-002 | Inline card editor in `public/app.js`; store update | store update test |
| SCN-003 | `BookmarkStore.findByAddress/create`; duplicate return and highlight in `public/app.js` | exact duplicate test |
| SCN-004, SCN-005 | Tag dialog/suggestions in `public/app.js`; store tag update | tag uniqueness test |
| SCN-006, SCN-007 | Tag pills/sidebar filters and `filterBookmarks` | filter test |
| SCN-008, SCN-009, SCN-023 | Search/sort controls, empty state, and `filterBookmarks` | full-field/search/sort test |
| SCN-010 | Note side-panel dialog and store note update | store update test |
| SCN-011–SCN-013, SCN-024 | Read later card actions, view, counts, and empty state | store update and filter tests |
| SCN-014, SCN-015 | Archive menu action, navigation, restore button, and counts | store update and filter tests |
| SCN-016 | Named delete confirmation and DELETE endpoint | remove path exercised by store/bulk tests; browser acceptance |
| SCN-017–SCN-020 | Persistent card selection, bulk toolbar/dialogs, `/api/bulk`, `BookmarkStore.bulk` | bulk action test; browser acceptance |
