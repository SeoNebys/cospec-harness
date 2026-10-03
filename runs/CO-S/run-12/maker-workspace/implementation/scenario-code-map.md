# Scenario-to-code map

| Scenario | Primary implementation | Automated coverage |
|---|---|---|
| SCN-001 | `public/app.js` save flow and cards; `lib/metadata.js`; `lib/store.js` | domain, store, API; browser flow |
| SCN-002 | `public/app.js` tag choices, tag navigation; `lib/bookmarks.js` | domain, store; browser flow |
| SCN-003 | `public/app.js` details/edit note views; `lib/store.js` | store; browser flow |
| SCN-004 | `public/app.js` `searchMatch` and note excerpts | domain; browser flow |
| SCN-005 | `public/app.js` Read later actions and view | API; browser flow |
| SCN-006 | `server.js` metadata precheck; `lib/store.js` duplicate guard | store, API; browser flow |
| SCN-007 | `public/app.js` archive/restore; `lib/store.js` | store, API; browser flow |
| SCN-008 | `server.js` metadata error response; `public/app.js` manual fallback | browser flow |
| SCN-009 | `public/app.js` `renderEmpty` first-use state | browser flow |
| SCN-010 | `public/app.js` no-results rendering | domain; browser flow |
| SCN-011 | `public/app.js` empty Read later state | browser flow |
| SCN-012 | `lib/bookmarks.js` URL validation; `public/app.js` inline error | domain, API; browser flow |
| SCN-013 | `styles.css` card clamping, sticky navigation, responsive grid | browser layout checks |
| SCN-014 | `lib/bookmarks.js` `normalizeTag` and tag deduplication | domain, store |
| SCN-015 | `lib/store.js` snapshot persistence and explicit updates only | store, API |
