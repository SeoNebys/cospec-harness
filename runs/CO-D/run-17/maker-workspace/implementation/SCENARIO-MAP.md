# Scenario → code mapping (for later-cycle impact analysis)

| Scenario | Behaviour | Primary code | Tests |
|----------|-----------|--------------|-------|
| SCN-001 | Save with reviewed auto-filled details | `public/js/app.js` save flow (`saver` submit, `renderDraft`, `confirmDraft`); `lib/metadata.js`; `POST /api/links` in `server.js` | `test/metadata.test.js`, acceptance SCN-001 |
| SCN-002 | Address validation; fetch-failure manual fallback | `core.js normalizeUrl`; `app.js` invalid branch + `fetchFailed` draft; `metadata.fetchMetadata` (`ok:false`) | `test/core.test.js`, `test/metadata.test.js`, acceptance SCN-002 |
| SCN-003 | Duplicate → open existing | `app.js` save (existing check) + 409 handling; `server.js` create 409 | acceptance SCN-003 |
| SCN-004 | Edit title/description/note later | `app.js` `startEdit/saveEdit`; `PATCH /api/links/:id` | acceptance (edit paths) |
| SCN-005 | Edit address with reviewed re-fetch + guards | `app.js` `fetchNewAddress/saveEdit`; server PATCH url validation/409 | acceptance (edit) |
| SCN-006 | Reading/reference via `toRead` | `app.js` `markRead/markToRead`, `counts/visible`, shelf pills | acceptance SCN-006 |
| SCN-007 | Tags, reuse suggestions, include/exclude filters | `app.js` `tagEditor/showTagSuggest`, tag-filter chips | acceptance (tags) |
| SCN-008 | Search query grammar | `core.js parseQuery/evalQuery/collectQueryTerms` | `test/core.test.js`, acceptance SCN-008 |
| SCN-009 | Personal Markdown note | `core.js markdownToHtml`; `app.js noteField` + render | `test/core.test.js`, acceptance SCN-009 |
| SCN-010 | Archive / restore / archive-only delete | `app.js archiveLink/restoreLink/deleteLink`; server DELETE | acceptance SCN-010 |
| SCN-011 | Sort (incl. recently-updated) | `app.js sortList`; `updatedSeq` from `store.js` | acceptance SCN-011 |
| SCN-012 | Bulk actions incl. select-all-matching | `app.js renderBulk/bulkOp/pruneSelection`; `POST /api/links/bulk`; `store.bulkUpdate` | `test/store.test.js`, acceptance SCN-012 |
| SCN-013 | Saved views (search + include/exclude) | `app.js saveCurrentView/applySavedView`; saved-view API | `test/store.test.js`, acceptance SCN-013 |
| SCN-014 | Import/export bookmark HTML | `core.js parseBookmarksHtml/buildBookmarksHtml/normalizeAddDate`; `app.js doImport/doExport`; `POST /api/links/bulk-create` | `test/core.test.js` |
| SCN-015 | Display preferences (order/perPage/text size) synced | `app.js renderPrefs/savePrefs/pagination`; `PUT /api/preferences`; `store.setPreferences` | `test/store.test.js`, acceptance SCN-015 |

Deferred (LATER-002): preserved copies / Internet Archive — intentionally NOT
implemented; no non-functional buttons shipped.
