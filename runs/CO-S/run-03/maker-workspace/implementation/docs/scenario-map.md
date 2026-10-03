# Scenario-to-code mapping

| Scenarios | Production areas | Automated coverage |
|---|---|---|
| SCN-001, SCN-010, SCN-014 | `server.js` create route, `metadata.js`, save form in `app.js` | API save/validation/fallback tests; browser save flow |
| SCN-002, SCN-005, SCN-012 | PATCH route and inline detail editor in `app.js` | API edit/title tests; browser inline edit flow |
| SCN-003, SCN-004, SCN-011, SCN-016 | Tag routes, normalization, tag controls/filtering in `app.js` | API tag test; browser tag add/filter/remove flow |
| SCN-006, SCN-013 | `filteredBookmarks` and search/empty rendering in `app.js` | Browser search and no-match flow |
| SCN-007, SCN-014, SCN-015 | Bookmark unread/archive fields, view filtering, status controls | API state test; browser unread/archive flow |
| SCN-008 | Archive/restore PATCH calls, toast Undo, archived view | API state test; browser archive/undo/restore flow |
| SCN-009, SCN-017 | DELETE route, More menu, named dialog, empty rendering | API deletion test; browser delete/empty flow |

`api.test.js` also covers persistence-facing service behavior and metadata
parsing. `browser_acceptance.py` covers the integrated UI with a real browser.
