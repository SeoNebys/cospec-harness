# Scenario-to-code mapping

| Scenario | Production code | Automated coverage |
|---|---|---|
| SCN-001 | `src/capture.js`, `src/service.js`, save form in `public/app.js` | `service.test.js`, `app.e2e.js` |
| SCN-002, SCN-018 | bookmark patch API and details panel | `service.test.js`, `app.e2e.js` |
| SCN-003, SCN-014 | list query in `src/store.js`, live search and empty state | `store.test.js`, `app.e2e.js` |
| SCN-004, SCN-015 | tag tables and tag panel | `store.test.js`, `app.e2e.js` |
| SCN-005, SCN-019 | list query ordering/paging and toolbar | `store.test.js`, `app.e2e.js` |
| SCN-006, SCN-016 | saved-view API, dialog, sidebar restore | `store.test.js`, `app.e2e.js` |
| SCN-007 | Read later API and direct card action | `service.test.js`, `app.e2e.js` |
| SCN-008, SCN-022 | Archive/restore transitions | `service.test.js`, `app.e2e.js` |
| SCN-009, SCN-017 | delete API and warning dialog | `service.test.js`, `app.e2e.js` |
| SCN-010, SCN-013, SCN-021 | immutable capture storage, manual fallback, reader | `capture.test.js`, `service.test.js`, `app.e2e.js` |
| SCN-011 | canonical URL uniqueness | `url.test.js`, `service.test.js` |
| SCN-012 | client and API URL validation | `url.test.js`, `app.e2e.js` |
| SCN-020 | SQLite-backed storage | `persistence.test.js` |
