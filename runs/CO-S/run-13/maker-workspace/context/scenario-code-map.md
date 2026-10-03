# Scenario → code / test mapping (cycle 1)

Basis for impact analysis in later cycles. Paths are under `implementation/`.

| Scenario | Behaviour | Primary code | Tests |
|---|---|---|---|
| SCN-001 | Save with auto-collected details + tags/note | `src/metadata.js` (parse/fetch), `server.js` (`/api/fetch-metadata`, `POST /api/bookmarks`), `src/store.js` (`create`), `public/app.js` (`onGetDetails`, `onSave`, `showAuto`) | `test/unit/metadata.test.js`, `test/unit/store.test.js`, `test/acceptance/saving.spec.js` |
| SCN-002 | Reuse existing tags via suggestion dropdown | `public/app.js` (`showSuggest`, `addSuggestedTag`, `existingTags`) | `test/acceptance/organizing.spec.js` |
| SCN-003 | Search across all fields, live, highlighted | `public/app.js` (`matchesQuery`, `hl`, search input) | `test/acceptance/organizing.spec.js` |
| SCN-004 | Filter by clicking a tag; banner; combines w/ search | `public/app.js` (`matchesTag`, `renderActiveFilter`, `onListClick` chip) | `test/acceptance/organizing.spec.js` |
| SCN-005 | Sort newest/oldest/A–Z/Z–A; persists | `public/app.js` (`sortShown`, `#sort`) | `test/acceptance/organizing.spec.js` |
| SCN-006 | Read-later marker + focused tab + empty state | `src/store.js` (`update readLater`), `public/app.js` (`toggle`, tabs, `matchesView`) | `test/acceptance/organizing.spec.js` |
| SCN-007 | Archive/restore; excluded from All & search; empty | `src/store.js` (`update archived`), `public/app.js` (`toggle`, `matchesView`, card actions) | `test/acceptance/organizing.spec.js` |
| SCN-008 | Edit bookmark incl. address; site follows; collision blocked | `src/store.js` (`update`), `server.js` (`PATCH`), `public/app.js` (`cardEditForm`, `saveEdit`) | `test/unit/store.test.js`, `test/acceptance/editing.spec.js` |
| SCN-009 | No duplicates — go to existing & edit (incl. archived) | `src/store.js` (`findByUrl`, `create` DuplicateError), `server.js` (409), `public/app.js` (`goToExisting`) | `test/unit/store.test.js`, `test/acceptance/editing.spec.js` |
| SCN-010 | Forgiving entry, mistyped address, unreadable details | `src/url.js` (`normalizeUrl`), `src/metadata.js` (`fetchMetadata` ok:false) | `test/unit/url.test.js`, `test/unit/metadata.test.js`, `test/acceptance/saving.spec.js` |
| SCN-011 | Brand-new empty library | `public/app.js` (`render` empty branch) | `test/acceptance/editing.spec.js` |
| SCN-012 | Long text / many tags wrap in card | `public/app.css` (overflow-wrap), `public/app.js` (`cardView`) | `test/acceptance/editing.spec.js` |
