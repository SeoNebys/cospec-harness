# Scenario → code mapping — Cycle 1

Basis for impact analysis on future change requests. Paths are under
`/work/implementation`.

| Scenario | Behaviour | Primary code | Tests |
|----------|-----------|--------------|-------|
| SCN-001 | Save a link; auto-fill title/description/icon | `src/pageinfo.js` (fetch+parse), `src/app.js` `newLink`/POST, `public/app.js` save flow + `renderCard`, `public/logic.js` `ensureScheme`/`hostOf` | `test/unit/pageinfo.test.js`, `test/unit/api.test.js` (POST), `test/acceptance` SCN-001 |
| SCN-002 | Add/remove tags one at a time, suggestions, dedup | `public/logic.js` `normalizeTag`/`addTag`/`removeTag`/`allTags`, `src/app.js` `sanitizePatch` (tags), `public/app.js` tag row + `#known-tags` datalist | `test/unit/logic.test.js`, `test/unit/api.test.js` (PATCH), `test/acceptance` SCN-002 |
| SCN-003 | Opt-in reading list; distinct view; Done keeps saved | `public/app.js` reading-list control + views + `visibleLinks`, `public/logic.js` `visibleLinks`, `src/app.js` PATCH `inList` | `test/unit/logic.test.js`, `test/acceptance` SCN-003 |
| SCN-004 | Write/edit/clear a personal note | `public/app.js` note editor, `src/app.js` PATCH `note` | `test/unit/api.test.js`, `test/acceptance` SCN-004 |
| SCN-005 | Find via search (title/desc/tags/address/note) + tag filter, combine, no-results | `public/logic.js` `haystack`/`matchesSearch`/`matchesTags`/`visibleLinks`, `public/app.js` search box, tag-filter, highlight, empty states | `test/unit/logic.test.js`, `test/acceptance` SCN-005 |
| SCN-006 | Auto-fill fails → still save, address as title, manual title/description | `src/pageinfo.js` (ok:false path), `src/app.js` `newLink` `autoFailed`, `public/app.js` warn + manual title/desc affordances | `test/unit/pageinfo.test.js`, `test/unit/api.test.js`, `test/acceptance` SCN-006 |
| SCN-007 | Remove with confirmation; permanent | `public/app.js` remove row + confirm, `src/app.js` DELETE, `src/store.js` `remove` | `test/unit/api.test.js`, `test/acceptance` SCN-007 |
| SCN-008 | Save-time guards: duplicate + non-link + empty | `public/logic.js` `isPlausibleUrl`/`normalizeUrl`/`findDuplicate`, `src/app.js` POST (400/409), `public/app.js` save messages + jump-to-existing | `test/unit/logic.test.js`, `test/unit/api.test.js`, `test/acceptance` SCN-008 |
| SCN-009 | Empty states: first run, empty reading list, no matches; newest-first | `public/app.js` empty-state rendering + `visibleLinks` ordering | `test/unit/logic.test.js` (ordering), `test/acceptance` SCN-009 |

## Cross-cutting
- Persistence/durability: `src/store.js` — `test/unit/api.test.js` (reload test).
- Server routing/validation: `src/app.js` — `test/unit/api.test.js`.
