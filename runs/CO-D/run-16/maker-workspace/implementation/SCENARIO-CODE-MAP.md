# Scenario → code map (Cycle 1)

Basis for impact analysis on future change requests.

| Scenario | Behaviour | Primary code |
|----------|-----------|--------------|
| SCN-001 | Save with auto-filled details | `server.js` POST `/api/bookmarks`, `/api/metadata`; `src/metadata.js` (`fetchMetadata`, `parseMeta`); `public/app.js` `doLookup`/composer |
| SCN-002 | Tag suggestions when saving | `public/app.js` composer tag input + `usedTags` |
| SCN-003 | No duplicate on save; go to existing | `server.js` `findDuplicate`; `public/app.js` `showDuplicate` |
| SCN-004 | Edit link/title/description/tags/note | `server.js` PATCH `/api/bookmarks/:id`; `public/app.js` `openEditor`/`saveEdit` |
| SCN-005 | Editing a link into an existing one is prevented | `server.js` PATCH dup check; `public/app.js` `saveEdit` 409 handling |
| SCN-006 | Live search across all fields, case-insensitive | `src/query.js` `buildSearch`; `public/app.js` `render` |
| SCN-007 | Query language (#tag, AND/OR/NOT, (), "phrase") | `src/query.js` |
| SCN-008 | Click-a-tag filter; note excerpt on match | `public/app.js` `filterByTag`, `noteExcerpt` |
| SCN-009 | To read / Finished / All tabs; mark; never delete | `public/app.js` tabs, `toggleStatus`; `server.js` PATCH status |
| SCN-010 | Read-later choice at save | `server.js` create `readLater`→status; `public/app.js` `#readlater` |
| SCN-011 | Recover when a valid page can't be fetched | `src/metadata.js` failure path; `public/app.js` `doLookup` fetchnote |
| SCN-012 | Reject non-address | `src/urls.js` `isValidUrl`; server create + `/api/metadata`; app composer |
| SCN-013 | Empty states & long content | `public/app.js` `render` empty states; `public/styles.css` word-break |
| SCN-014 | Delete permanently with confirmation | `server.js` DELETE; `public/app.js` `deleteItem` |
| SCN-015 | Archive / restore | `server.js` PATCH archived; `public/app.js` `archiveItem`/`restoreItem`, Archived tab |
| SCN-016 | Bulk actions incl. whole-view select | `server.js` POST `/api/bookmarks/bulk`; `public/app.js` bulk + `selectall` (uses `lastShown`) |
| SCN-017 | Bulk tag add/remove with suggestions | `public/app.js` `openBulkTagPanel`, `tagsOnSelected` |
| SCN-018 | Sort by date / title | `public/app.js` `sortShown`, `#sortsel` |
| SCN-019 | Markdown notes, rendered on view | `src/markdown.js`; `public/app.js` note view toggle |
| SCN-020 | Preserved copy (page/PDF by content type) | `src/metadata.js` `captureSnapshot`; `server.js` `scheduleCapture`, `/snapshots/:id`, recapture |
| SCN-021 | Send to Internet Archive (on demand) | `src/metadata.js` `sendToArchive`; `server.js` `/api/bookmarks/:id/archive-web` |
| SCN-022 | Reusable saved searches | `server.js` `/api/searches`; `public/app.js` saved-search chips |
| SCN-023 | Import/export standard format | `src/netscape.js`; `server.js` `/api/export`, `/api/import` |
| SCN-024 | Display prefs (default sort, items shown, text size) | `server.js` `/api/prefs`; `public/app.js` prefs panel + pagination |
| SCN-025 | Title opens original address | `public/app.js` `renderItem` title anchor |

## Tests
- Unit (`node --test`): `tests/urls|query|netscape|markdown|metadata.test.mjs`.
- Acceptance (`npx playwright test`): `tests/acceptance.spec.mjs` (offline,
  isolated data), scenario IDs referenced per test.
