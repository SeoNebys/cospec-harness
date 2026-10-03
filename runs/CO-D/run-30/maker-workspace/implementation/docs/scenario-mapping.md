# Scenario-to-code mapping — cycle 1

| Scenarios | Production behavior | Primary code | Automated coverage |
|---|---|---|---|
| SCN-001, SCN-002 | Automatic metadata and editable save draft | `lib/metadata.js`, `app.js`, `public/app.js` | `metadata.test.js`, `api.test.js`, `e2e.spec.js` |
| SCN-003 | Direct card edit with immediate refresh | `public/app.js`, `PATCH /api/bookmarks/:id` | `e2e.spec.js` full journey |
| SCN-004, SCN-022 | Existing bookmark resolution and normalized duplicate identity | `lib/url.js`, `lib/database.js`, prepare/create API routes | `url.test.js`, `database.test.js`, `api.test.js`, `e2e.spec.js` |
| SCN-005, SCN-006, SCN-019 | Live case-insensitive search and honest empty result | `BookmarkStore.list`, `public/app.js` | `database.test.js`, `api.test.js`, `e2e.spec.js` |
| SCN-007, SCN-008, SCN-009, SCN-020 | Label filtering, picker, creation, multiple labels, capitalization reuse | label tables and store methods, `public/app.js` | `database.test.js`, `api.test.js`, `e2e.spec.js` |
| SCN-010, SCN-011 | Read later checkbox, filtered shelf, and unmarking | bookmark reading flag, list API, `public/app.js` | `database.test.js`, `e2e.spec.js` |
| SCN-012 | Permanent single deletion from editor | delete API and confirmation dialog | `e2e.spec.js` |
| SCN-013, SCN-014, SCN-015 | Deliberate selection mode, bulk delete, additive labels, and additive Read later | bulk API and selection UI | `database.test.js`, `e2e.spec.js` |
| SCN-016 | Archive and restore with details intact | bookmark archive flag and views | `database.test.js`, `e2e.spec.js` |
| SCN-017 | Editable site-name fallback when metadata is unavailable | `metadataWithFallback`, fallback UI | `metadata.test.js`, `e2e.spec.js` |
| SCN-018 | Reject incomplete addresses without guessing | `lib/url.js`, prepare API, inline URL error | `url.test.js`, `api.test.js`, `e2e.spec.js` |
| SCN-021 | Clamped card display with complete editor values | `styles.css`, edit state in `public/app.js` | browser journey plus visual verification |
| SCN-023 | Focused first-use empty collection | `renderLibrary`, `configureEmptyState` | `e2e.spec.js` |
| SCN-024 | Empty Read later shelf with route back | `configureEmptyState` | `e2e.spec.js` |
| SCN-025 | Archived duplicate remains archived and is explicitly identified | prepare API and `openEdit` | `api.test.js`, `e2e.spec.js` |
| SCN-026 | Failed save retains complete draft and retries cleanly | `saveBookmark`, operation-error UI | `e2e.spec.js` routed failure |
| SCN-027 | Saved details persist independently of original page | stored bookmark fields; no refresh path | `database.test.js`, design review |

