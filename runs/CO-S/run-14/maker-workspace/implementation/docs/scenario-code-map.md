# Scenario → code mapping (Cycle 1)

For impact analysis in later cycles. Paths are under `implementation/`.

| Scenario | Behaviour | Server | Frontend | Tests |
|---|---|---|---|---|
| SCN-001 | Save + auto details | `service.createBookmark`, `metadata.fetchMetadata` | `doSave`, `card` | service.test (create), acceptance |
| SCN-002 | Tags + note while saving, suggestions | `createBookmark` | `mountTagEntry`, save box | acceptance |
| SCN-003 | Edit tags/note later | `service.updateBookmark` | `noteBlock`, card tag chips | service.test, acceptance |
| SCN-004 | Read-later + view | `updateBookmark`, `getState` | `renderViews`, `actionsRow` | service.test, acceptance |
| SCN-005 | Archive / restore | `updateBookmark` | `actionsRow`, `inView` | service.test, acceptance |
| SCN-006 | Tag filter bar, combines | (client) | `renderTagFilter`, `visible` | acceptance |
| SCN-007 | Search query language | `src/query.js` (shared) | `currentMatcher`, `renderSyntax`, `hl` | query.test, acceptance |
| SCN-008 | Reject invalid link | `createBookmark` (invalid), `metadata.normalizeUrl` | `doSave` (400) | service.test, acceptance |
| SCN-009 | Duplicate → edit existing | `createBookmark` (duplicate), `normKey` | `doSave` (409), `jumpToEdit` | service.test, acceptance |
| SCN-010 | Unreadable page fallback | `createBookmark` (detailsMissing) | `doSave` opens edit | service.test, acceptance |
| SCN-011 | Edit title/description | `updateBookmark` | card edit panel | service.test, acceptance |
| SCN-012 | Long content clamp + tag wrap | — | `.clamp` CSS, `more` toggle | acceptance (via UI), styles.css |
| SCN-013 | Delete + undo, then permanent | `deleteBookmark`, `restoreBookmarks` | `doDelete`, toast undo | service.test, acceptance |
| SCN-014 | Change URL + optional refresh | `updateBookmark` (refresh) | card edit URL + checkbox | service.test, acceptance |
| SCN-015 | Sort | (client) | `sortList`, `#sort` | acceptance |
| SCN-016 | Bulk selection / all-in-view | `getState` | `renderBulkBar`, `.selbox` | acceptance |
| SCN-017 | Bulk tag/read/archive/delete + undo | `service.bulk` | bulk bar handlers, `bulkDelete` | service.test, acceptance |
| SCN-018 | Saved searches | `addSavedSearch`, `removeSavedSearch` | `renderSavedStrip`, `renderSaveSearchRow` | service.test, acceptance |
| SCN-019 | Full-page copy (manual/auto), PDF | `service.snapshot`, `src/snapshot.js`, auto in `createBookmark` | `captureCopy`, `openSnapshot` | service.test, acceptance |
| SCN-020 | Internet Archive | `service.archiveOrg`, `src/archive.js` | `doArchiveOrg`, badge | service.test, acceptance |
| SCN-021 | Import (folders→tags, dates, dupes) | `service.importBookmarks`, `importexport.parseNetscape` | `openImport`, `importPreview` | importexport.test, service.test, acceptance |
| SCN-022 | Export (browser file / backup) | `importexport.buildBookmarksHtml/buildBackupJson` | `openExport` | importexport.test, acceptance |
| SCN-023 | Display preferences | `updatePreferences` | `openPrefs`, `applyPrefs` | service.test, acceptance |
| SCN-024 | Pagination / page size | (client) | `renderList` paging | acceptance |
| SCN-025 | Markdown notes | `src/markdown.js` (shared) | `noteBlock` → `BMarkdown.render` | markdown.test, acceptance |

Core files: `src/server.js` (routing/static), `src/service.js` (domain),
`src/store.js` (persistence), `public/app.js` (UI), `public/styles.css`.
