# Scenario-to-code map

| Scenarios | Primary code | Automated coverage |
|---|---|---|
| SCN-001, SCN-013, SCN-018 | `server.js` preview/create/retry APIs; `public/app.js` save and review flow | `core.test.js`; `e2e.mjs` |
| SCN-002, SCN-016 | `src/core.js` URL normalization; `server.js` duplicate lookup | `core.test.js`; `e2e.mjs` |
| SCN-003, SCN-004 | `src/core.js` tag normalization; `public/app.js` typeahead/create control | `core.test.js`; `e2e.mjs` |
| SCN-005–SCN-008, SCN-014 | `src/core.js` search lexer/parser/evaluator; `/api/bookmarks`; search UI | `core.test.js`; `e2e.mjs` |
| SCN-009, SCN-017 | bookmark `readLater` state; navigation and empty-state rendering | `e2e.mjs` |
| SCN-010 | capture extraction, archive API, unavailable-page and reader dialogs | `core.test.js`; `e2e.mjs` |
| SCN-011 | bookmark-card renderer and separate-tab links | `e2e.mjs` plus DOM inspection |
| SCN-012, SCN-015 | signed session and password handling; login UI | `e2e.mjs` |
| SCN-019, SCN-021 | PATCH API and edit-dialog cancellation behavior | `e2e.mjs` |
| SCN-020, SCN-021 | DELETE API and pre-deletion confirmation | `e2e.mjs` |

`tests/core.test.js` is the unit-level specification for normalization, tagging, search, and capture. `tests/e2e.mjs` executes representative approved flows through the real server and browser.
