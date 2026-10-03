# Scenario-to-code mapping

| Scenarios | Implementation |
|---|---|
| SCN-001, SCN-010, SCN-011, SCN-016, SCN-017 | `public/app.js` capture flow; `lib/url.js`; `lib/metadata.js`; bookmark POST endpoint |
| SCN-002, SCN-015 | `public/app.js` tag editor; `lib/tags.js`; `BookmarkStore` normalization |
| SCN-003, SCN-012 | bookmark GET endpoint; `BookmarkStore.list`; search and empty states in `public/app.js` |
| SCN-004 | tag buttons and exact `tag` filtering in `public/app.js` and `BookmarkStore.list` |
| SCN-005, SCN-013, SCN-014 | read-later PATCH endpoint, sidebar view, star control, and empty state |
| SCN-006 | external title links rendered by `public/app.js` |
| SCN-007 | edit dialog, bookmark PUT endpoint, and `BookmarkStore.update` |
| SCN-008 | delete dialog, bookmark DELETE endpoint, and `BookmarkStore.remove` |
| SCN-009 | metadata endpoint duplicate lookup and prefilled edit dialog |

Tests: `test/core.test.js` covers internal rules and store behavior. `test/api.test.js` covers the HTTP lifecycle and production entry page.
