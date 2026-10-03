# Scenario → code / test mapping

Basis for impact analysis in later cycles.

| Scenario | Behaviour | Implementation | Tests |
|----------|-----------|----------------|-------|
| SCN-001 | Quick-save with auto-fill, tags, note; newest first | `src/metadata.js` (fetch/parse), `src/store.js#create`, `POST /api/metadata`, `POST /api/bookmarks`; UI `public/app.js#onFetch/onSave` | unit `store.test.js`, `metadata.test.js`, `api.test.js`; e2e `SCN-001/002` |
| SCN-002 | Broad search + tag filter | `src/store.js#list/tagsForView`, `GET /api/bookmarks`; UI `renderFilterChips/renderItems` | unit `store.test.js` (search), `api.test.js`; e2e `SCN-001/002` |
| SCN-003 | Reversible read-later, separate view | `src/store.js#setLater/_inView`, `POST /api/bookmarks/:id/later`; UI later button + badge | unit `store.test.js`, `api.test.js`; e2e `SCN-003` |
| SCN-004 | Archive out of everyday views; searchable + restorable | `src/store.js#setArchived/_inView`, `POST /api/bookmarks/:id/archive`; UI archive/restore | unit `store.test.js`, `api.test.js`; e2e `SCN-004` |
| SCN-005 | Empty + no-results states | UI `public/app.js` `EMPTY_MSG` + no-results branch in `renderItems` | e2e `SCN-005` (two tests) |
| SCN-006 | Save when auto-fill fails; refuse invalid link | `src/store.js#coerceUrl`, title fallback in `create`; `POST /api/metadata` (400 + fetched:false); UI `failBanner` | unit `store.test.js`, `metadata.test.js`, `api.test.js`; e2e `SCN-006` |
| SCN-007 | Duplicate warning → edit existing; edit anytime | `src/store.js#normalizeUrl/findByUrl/update`, duplicate report in `POST /api/metadata`, 409 guard, `PUT /api/bookmarks/:id`; UI `showDuplicate/startEditExisting` | unit `store.test.js`, `api.test.js`; e2e `SCN-007` |
