# Approved scenario to production-code map

| Scenarios | Production behavior | Primary code | Verification |
|---|---|---|---|
| SCN-001, 024, 025 | Save validation, automatic metadata, honest fallback/retry | `public/app.js` `saveBookmark`, `retryCapture`; `server.js` `capture` | browser acceptance; manual browser matrix |
| SCN-002–004 | Inline edit, address correction, independent personalized fields | `public/app.js` `modalEdit` | browser acceptance matrix |
| SCN-005–006 | Label suggestion/create/remove, counts and filtering | `public/app.js` `modalEdit`, `labels`, `bindShell` | browser acceptance matrix |
| SCN-007–015, 028–029 | Full-text, label, phrase, logical search, syntax/empty feedback | `core.js` search compiler; mirrored browser compiler and `collection` | `core.test.js`; `acceptance.test.js` |
| SCN-016–017, 031 | Read later, Finished, Undo and empty state | `public/app.js` `finish`, `saveBookmark`, `collection` | `acceptance.test.js` |
| SCN-018–019 | Distinct rich personal notes with toolbar and search text | `public/app.js` `modalEdit`, `card`, `textOf` | browser acceptance matrix |
| SCN-020, 030 | Exact and harmless-variation duplicate detection | `core.js`/`public/app.js` `normalize`, `saveBookmark` | `core.test.js`; browser acceptance matrix |
| SCN-021 | Confirmed permanent deletion | `public/app.js` `modalDelete` | browser acceptance matrix |
| SCN-022–023 | Archive, restore and Undo with preserved information | `public/app.js` `archive`, `restore`, `activeItems` | browser acceptance matrix |
| SCN-026–027 | Stored readable page/PDF, search text, open/download copy | `server.js` `capture`; `public/app.js` `modalDetails` | `acceptance.test.js`; file-response checks |
| SCN-032 | Compact cards and expanded complete details | `styles.css` card clamping; `public/app.js` `modalDetails` | responsive browser checks |
| SCN-033 | Review-first browser import, nested folders to labels, title/date and duplicate preservation | `public/app.js` `bindTransfer`, `importNow` | browser acceptance matrix |
| SCN-034 | Browser-folder export and complete portable backup | `server.js` `browserExport`, export endpoints | endpoint checks |
| SCN-035 | Active-view sorting | `core.js` `sortBookmarks`; `public/app.js` `activeItems` | `core.test.js` |
| SCN-036–037 | Scoped bulk label/archive and batch Undo | `public/app.js` selection, `bulkAdd`, `archive` | browser acceptance matrix |
| SCN-038–039 | Store query shortcut and rerun against current collection | `public/app.js` `modalSaveSearch`, saved-search handler | browser acceptance matrix |
| SCN-040 | Immediate preference preview, saved defaults and temporary ordering | `public/app.js` `preferences`, `activeItems` | `acceptance.test.js` |

“Browser acceptance matrix” denotes the full interactive pass performed during Phase 3 and recorded in `VERIFICATION.md`.
