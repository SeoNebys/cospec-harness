# Scenario → code mapping (for later-cycle impact analysis)

| Scenario | Behaviour | Server (server.js / src) | Client (public) | Tests |
|----------|-----------|--------------------------|-----------------|-------|
| SCN-001 | Save via review with fetched details | `POST /api/fetch-meta`, `POST /api/bookmarks`; `src/metadata.js` | `onSaveSubmit`, `openCompose` | unit urls; integration fetch-meta/create; e2e SCN-001 |
| SCN-002 | Duplicate → open existing | `dedupKey` guard on create (409); `src/urls.js` | `onSaveSubmit`→`openExisting` | unit dedupKey; integration duplicate; e2e SCN-002 |
| SCN-003 | Edit title/description/address | `PATCH /api/bookmarks/:id` | `renderEditor` | integration lifecycle; e2e SCN-008/009 (editor) |
| SCN-004 | Live search + query language | `src/search.js` (client) | `render`, `highlighter` | unit search; e2e SCN-004 |
| SCN-005 | Reading-list status | `PATCH {toRead}` | `renderMeta` mark actions, `inView` | e2e SCN-005/006/007 |
| SCN-006 | Archive / restore | `PATCH {archived}` | mark/restore, `inView` archived | integration; e2e |
| SCN-007 | Delete with confirmation | `DELETE /api/bookmarks/:id` | `renderDeleteConfirm` | integration; e2e |
| SCN-008 | Tags (normalise, autocomplete, filter) | `src/tags.js`; create/patch normalise | `tagEditor`, tag chips | unit tags; e2e SCN-008 |
| SCN-009 | Markdown notes, searchable, collapsible | `src/markdown.js` | note render + `highlightWithin` + collapse | unit markdown; e2e SCN-008/009 |
| SCN-010 | Empty-data states | — | `render` empty branches | e2e (implicit) |
| SCN-011 | Invalid address / fetch fallback | `isValidUrl` (400); `metadata` fallback | invalid notice; failed compose | unit urls; integration fallback |
| SCN-012 | Long text wrap/clamp | — | desc clamp + show more; CSS | e2e (render) |
| SCN-013 | Sorting incl. recently-updated | `src/sort.js`; `updatedAt` bumps | `#sortSelect`, `comparator` | unit sort; e2e SCN-013/018 |
| SCN-014 | Bulk actions + safeguards | `POST /api/bulk` | `buildBulkBar`, selection clear on view/search | integration bulk; e2e SCN-014 |
| SCN-015 | Saved searches (unique names) | `POST/DELETE /api/saved-searches` (409) | `renderSaved` | integration; e2e SCN-015 |
| SCN-016 | Offline copy + Internet Archive | `.../offline`, `.../archive`; `src/offline.js`, `src/archive.js` | `renderMeta` offline/archive | integration offline/archive; e2e SCN-016 |
| SCN-017 | Import / export | `POST /api/import`, `GET /api/export`; `src/importexport.js` | import/export wiring | unit importexport; integration import; e2e (export link) |
| SCN-018 | Display preferences | `PUT /api/prefs` | `buildSettings`, paging, `applyTextSize` | integration prefs; e2e SCN-013/018 |
| SCN-019 | New-block edge cases | import no-links; offline+archive/delete; page size All | `render`, bulk, import msg | integration; e2e |
