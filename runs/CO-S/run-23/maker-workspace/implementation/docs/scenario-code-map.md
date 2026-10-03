# Scenario-to-code map

| Scenario | Primary implementation | Automated coverage |
|---|---|---|
| SCN-001 | `src/server.js` POST collection; `src/metadata.js`; save form and card rendering in `public/app.js` | `tests/api.test.js` lifecycle; browser verification |
| SCN-002 | API query filtering and `visibleBookmarks()` in `public/app.js` | `tests/api.test.js` uppercase search; browser verification |
| SCN-003 | Tag persistence in `src/store.js`; tag buttons and active filter in `public/app.js` | `tests/api.test.js` tag filter; browser verification |
| SCN-004 | `read_later` storage; view and card actions in `public/app.js` | `tests/api.test.js` read-later lifecycle; browser verification |
| SCN-005 | Canonical lookup in POST; duplicate response and notice in `public/app.js` | `tests/api.test.js` exact duplicate |
| SCN-006 | PATCH item route; edit dialog in `public/index.html` and `public/app.js` | `tests/api.test.js` edit and tag assignment; browser verification |
| SCN-007 | DELETE item route; in-card confirmation in `public/app.js` | `tests/api.test.js` deletion; browser verification |
| SCN-008 | `parseWebAddress()` and API validation; inline save error | `tests/urls.test.js`; `tests/api.test.js` invalid input |
| SCN-009 | metadata error fallback in POST and UI success message | `tests/api.test.js` unavailable metadata; browser verification |
| SCN-010 | no-match and recovery rendering in `public/app.js` | browser verification |
| SCN-011 | `canonicalizeAddress()` tracking and fragment handling | `tests/urls.test.js`; `tests/api.test.js` varied duplicate |
| SCN-012 | card clamps and four-tag summary in `public/styles.css` and `public/app.js` | browser verification |
| SCN-013 | SQLite store and startup load; temporary browser search state | `tests/api.test.js` close/reopen persistence; browser verification |
| SCN-014 | empty collection rendering and post-delete focus in `public/app.js` | `tests/api.test.js` delete all; browser verification |
| SCN-015 | canonical conflict lookup in PATCH; dialog error handling | `tests/api.test.js` conflicting edit; browser verification |
