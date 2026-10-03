# Scenario-to-code map

| Scenarios | Behavior | Production code | Tests |
|---|---|---|---|
| SCN-001, SCN-011, SCN-012 | Save, validate, and fall back | `server.mjs`, `store.mjs`, `public/app.js` (`saveBookmark`) | `domain.test.mjs`, `api.test.mjs`, `e2e.py` |
| SCN-002 | Retrieve and present page details | `metadata.mjs`, `server.mjs`, `public/app.js` (`lookUpMetadata`) | `domain.test.mjs`, `e2e.py` |
| SCN-003, SCN-016 | Duplicate normalization and inline edit focus | `store.mjs` (`canonicalizeAddress`, `create`), `public/app.js` (`focusExistingBookmark`) | `domain.test.mjs`, `api.test.mjs`, `e2e.py` |
| SCN-004, SCN-014 | Ordered collection, open in new tab, empty state | `store.mjs` (`list`), `public/app.js` (`buildBookmarkRow`, `renderCollection`) | `domain.test.mjs`, `e2e.py` |
| SCN-005, SCN-010, SCN-017 | Menu removal, eight-second Undo, last-item state | `store.mjs` (`remove`, `restore`, `purge`), `public/app.js` (`removeBookmark`) | `domain.test.mjs`, `api.test.mjs`, `e2e.py` |
| SCN-006, SCN-007, SCN-013 | Instant, case-insensitive search and zero results | `public/app.js` (`currentMatches`, `renderCollection`) | `e2e.py` |
| SCN-008 | Overlapping tags and clickable tag filtering | `public/app.js` (`renderTagFilters`, `buildBookmarkRow`) | `domain.test.mjs`, `e2e.py` |
| SCN-009, SCN-015 | Tag suggestions, creation, and normalization | `store.mjs` (`normalizeTags`, `tagSuggestions`), `public/app.js` (tag composer functions) | `domain.test.mjs`, `api.test.mjs`, `e2e.py` |
