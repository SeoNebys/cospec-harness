# Scenario-to-code map

| Scenarios | Production code | Automated coverage |
|-----------|-----------------|--------------------|
| SCN-001, SCN-011, SCN-012 | `public/app.js` add flow; `src/metadata.js`; metadata API | `metadata.test.js`, `api.test.js`, `e2e.js` |
| SCN-002, SCN-013, SCN-020 | `src/store.js` create/order/persist; add form rendering | `store.test.js`, `api.test.js`, `e2e.js` |
| SCN-003 | Bookmark card open action in `public/app.js` | `e2e.js` |
| SCN-004, SCN-005 | Tag editor, tag filter, store tag normalization | `store.test.js`, `e2e.js` |
| SCN-006, SCN-014 | Full-library live search and empty result rendering | `e2e.js` |
| SCN-007, SCN-008, SCN-015 | Read later mutation, views, and empty state | `api.test.js`, `e2e.js` |
| SCN-009, SCN-018, SCN-019 | Inline edit form, validation, failure preservation | `store.test.js`, `api.test.js`, `e2e.js` |
| SCN-010 | Confirmation and delete API | `api.test.js`, `e2e.js` |
| SCN-016 | Compact/expandable card rendering | `e2e.js` |
| SCN-017 | Visible batching with whole-library search/filter | `e2e.js` |

The Gherkin in `context/scenarios/` remains the acceptance source of truth.
