# Scenario-to-code map

| Scenario | Production behavior | Browser acceptance coverage | Unit coverage |
|---|---|---|---|
| SCN-001 | `app.js` save dialog/render; `domain.js:addBookmark` | `tests/acceptance.mjs` SCN-001 | `domain.test.mjs` SCN-001 |
| SCN-002 | `app.js` selection/group rendering; `domain.js:createCollectionAndAssign` | SCN-002 | SCN-002 |
| SCN-003 | `app.js` finder/filter rendering; `domain.js:findBookmarks` | SCN-003 | SCN-003 |
| SCN-004 | `app.js` direct/multi delete dialog; `domain.js:deleteBookmarks` | SCN-004 | SCN-004 |
| SCN-005 | `app.js` inline save errors; `domain.js:validateBookmarkDraft` | SCN-005 | SCN-005 |
| SCN-006 | `app.js:renderNoResults` and clear-search handler | SCN-006 | `findBookmarks` tests under SCN-003 |
| SCN-007 | `app.js` existing destination choices; `domain.js:assignToCollection` | SCN-007 | SCN-007 |
| SCN-008 | `app.js` inline collection errors; `domain.js:validateCollectionName` | SCN-008 | SCN-008 |
| SCN-009 | `app.js` cancel handler and `renderEmptyState` | SCN-009 | deletion state transition under SCN-004 |
| SCN-010 | `storage.js`; transient `view` state in `app.js` | SCN-010 | SCN-010 |
| SCN-011 | `app.js:createCard` whole-card new-tab handler | SCN-011 | Browser-only interaction |
| SCN-012 | `styles.css` long-text rules; `domain.js:findBookmarks`; list rendering | SCN-012 | search rules under SCN-003 |

All browser acceptance cases exercise the production page through visible user interactions. State seeding is used only to establish scenario preconditions efficiently.
