# Scenario → code mapping (impact-analysis basis)

| Scenario | Behaviour | Server / API | Frontend | Shared | Tests |
|---|---|---|---|---|---|
| SCN-001 | Save with auto-filled details, tags, note, read-later | `POST /api/metadata`, `POST /api/bookmarks` | `startCapture`, `fillForm`, `commitSave` | `metadata.js`, `normalize.js` | api: create; e2e: manual save |
| SCN-002 | Existing-tag suggestions | — | `attachSuggest` (`#tags`) | — | e2e (save flow) |
| SCN-003 | Duplicate → edit existing | dedupe in `POST /api/metadata`/`/bookmarks` (409) | `openEdit` on `existing` | `normalize.js#urlKey` | api: dedupe; unit: urlKey |
| SCN-004 | Search query language | (client filters) | `render` filter | `query.js` | unit; e2e |
| SCN-005 | Browse by tag + combine w/ search | (client) | `renderTagbar`, `renderBanner` | `query.js` | e2e |
| SCN-006 | Read-later view + mark read | `PUT /api/bookmarks/:id {readLater}` | `renderTabs`, `cardAction` | — | api; e2e |
| SCN-007 | Sort with remembered default | `PUT /api/prefs` | `sortBookmarks`, `renderSort`, settings | — | api; e2e |
| SCN-008 | Unreadable page still saveable | `metadata.js` failed path | `fillForm("failed")` | `metadata.js` | (manual/e2e save) |
| SCN-009 | Reject non-links; accept scheme-less | `normalizeInput` | `startCapture`/`commitSave` errors | `normalize.js` | unit |
| SCN-010 | Empty states + long content | — | `render` empty branches | — | e2e empty |
| SCN-011 | Edit any field / delete / open | `PUT`, `DELETE /api/bookmarks/:id` | `openEdit`, `cardAction`, card click | `normalize.js` | api collision/delete; e2e |
| SCN-012 | Archive vs delete, own view, restore | `PUT {archived}` | tabs, `cardAction`, `baseForView` | — | api; e2e |
| SCN-013 | Bulk actions + select-all-matching | `POST /api/bookmarks/bulk` | `renderBulk`, `applyBulk` | — | api; e2e |
| SCN-014 | Formatted notes | — | `renderNote`, `formatNote`, toolbar | `notes.js` | unit; e2e |
| SCN-015 | Preserve copy + Internet Archive + PDF | `POST .../preserve`, `.../internet-archive`, `GET /preserved/:id` | `cardAction` preserve/ia, `preservationRow` | `preserve.js`, `archive.js`, `normalize.js#isPdf` | unit: isPdf |
| SCN-016 | Saved filters (include/exclude) | `POST/DELETE /api/filters` | `renderSaved`, `applyFilter` | — | api; e2e |
| SCN-017 | Import/export bookmarks file | `GET /api/export`, `POST /api/import` | Settings data tools | `netscape.js` | unit; api; e2e |
| SCN-018 | Display prefs (sort, per-page, text size) | `PUT /api/prefs` | settings, pagination, `applyTextSize` | — | e2e |
