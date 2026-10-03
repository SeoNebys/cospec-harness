# Scenario-to-code map

| Scenarios | Production code |
|---|---|
| SCN-001, SCN-002, SCN-009, SCN-010 | `server.js` metadata/save endpoints; `public/app.js` save and review flow |
| SCN-003, SCN-014 | `server.js` `canonicalizeUrl`, unique storage rule, duplicate metadata response; duplicate focus in `public/app.js` |
| SCN-004, SCN-011 | bookmark query/search in `server.js`; live search and empty state in `public/app.js` |
| SCN-005, SCN-013 | note sanitization in `server.js`; inline formatted-note editor and folding in `public/app.js` |
| SCN-006, SCN-007, SCN-015 | label storage/query in `server.js`; label filters and suggestion control in `public/app.js` |
| SCN-008, SCN-012 | Read later query/update in `server.js`; navigation, counts, completion, and empty state in `public/app.js` |
| SCN-016 | immutable-by-default stored page details in `server.js` (no refresh path) |

Tests are in `implementation/tests/` and `implementation/tests/e2e.py`.
