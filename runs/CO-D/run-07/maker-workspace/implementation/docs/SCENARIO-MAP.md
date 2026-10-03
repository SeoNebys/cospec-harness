# Scenario → code mapping (cycle 1)

Basis for later-cycle impact analysis. Files are under `implementation/`.

| Scenario | Behaviour | Server | Frontend | Tests |
|---|---|---|---|---|
| SCN-001 | Save w/ auto-filled preview → confirm | `server.js` `/api/preview`, `/api/bookmarks`; `src/metadata.js` | `app.js` `startSave`, `openEditPanel(isNew)` | accept: SCN-001; unit: (metadata fallback covered) |
| SCN-002 | Correct details in shared edit screen | `/api/bookmarks/:id` PATCH | `openEditPanel`, `openEditExisting` | accept: SCN-001/002 |
| SCN-003 | Same-link dedup on save | `normalizeUrl`, `findByNorm` in `server.js` | `startSave` duplicate branch | unit: normalize; accept: SCN-003/011 |
| SCN-004 | Tags (reuse) + formatted note | `cleanTags`; note stored raw | `openEditPanel` tag editor, `renderNote` | accept: SCN-004 |
| SCN-005 | Search language + tag/status filters | `src/query.js` (served `/lib`) | `computeMatching`, `buildQuery`, `renderFilters` | unit: query; accept: SCN-005 |
| SCN-006 | To read / Finished + views | PATCH status | `#segment`, `computeMatching` | accept: SCN-006 |
| SCN-007 | Empty & no-results states | — | `render` placeholders | accept: SCN-005/006 (empty), SCN-012 |
| SCN-008 | Non-link blocked; unreadable saveable | `isPlausibleLink`; `metadata` fallback | `startSave` validate; warning banner | unit: normalize; accept: SCN-008 |
| SCN-009 | Sorting | prefs.sort | `computeMatching` sort; `#sort` | accept: SCN-009/017 |
| SCN-010 | Remembered sort + Settings | `/api/prefs` | `openSettings`; server-persisted prefs | accept: SCN-009/017 (persist) |
| SCN-011 | Open/edit-address/delete; action layout | PATCH url dedup; DELETE | `cardEl`, `actions`, `confirmDelete` | accept: SCN-003/011 |
| SCN-012 | Archive / restore (separate link) | PATCH archived | `#archiveBtn`, scope in `computeMatching` | accept: SCN-012 |
| SCN-013 | Bulk actions (Select mode) | `/api/bulk` | `renderBulkBar`, `bulk`, `bulkTags` | accept: SCN-013 |
| SCN-014 | Saved views (rule) | `/api/views` | `openSaveView`, `applyView`, `renderViewsMenu` | accept: SCN-014 |
| SCN-015 | Preserved copies + Internet Archive | `/api/bookmarks/:id/copy`, `/ia`; `src/preserve.js`; auto in create | `pollCopy`, `copyLine`, More actions | accept: SCN-015 |
| SCN-016 | Import / export | `/api/import(/preview)`, `/api/export`; `src/bookmarks.js` | `openImport`, `openExport` | unit: bookmarks; accept: SCN-016 |
| SCN-017 | Items-per-page + text size | prefs.pageSize/textSize | pager in `render`, `applyTextSize` | accept: SCN-009/017 |

Cross-cutting: `src/store.js` (persistence, all scenarios), `src/net.js`
(fetch guard for SCN-001/015).
