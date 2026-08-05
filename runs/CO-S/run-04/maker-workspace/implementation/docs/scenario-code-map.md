# Scenario → code mapping (cycle 1)

Basis for judging impact scope on future change requests.

| Scenario | Behaviour | Server code | Client code | Tests |
|----------|-----------|-------------|-------------|-------|
| SCN-001 | Save a link; auto page name; newest first; count | `app.js` POST `/api/bookmarks`, `titleFetcher.fetchTitle`, `links.extractTitle`, `store.add` | `app.js` `doSave` / `renderPending` / `renderRow`, `index.html` adder | `acceptance` SCN-001, `links` extractTitle, `store` add |
| SCN-002 | Open (click name); rename via hover pencil, inline; Escape cancels; empty keeps name | `app.js` PATCH `/api/bookmarks/:id`, `store.rename` | `app.js` `startRename`, `renderRow` (anchor = open) | `acceptance` SCN-002, `store` rename |
| SCN-003 | Browse list + live search (name+address), highlight, "N of M", no-match | (GET list only) | `app.js` `render`/`matches`/`highlight`, search input handler | (client-side; covered by manual verification in Phase 3) |
| SCN-004 | Remove instantly; Undo restores to original position | `app.js` DELETE + POST `/:id/restore`, `store.remove`/`store.restore` | `app.js` `removeBookmark`/`showToast`/undo handler | `acceptance` SCN-004, `store` remove/restore/idempotent |
| SCN-005 | Welcoming empty state; count hidden | (GET returns `[]`) | `app.js` `render` empty branch, `styles.css` `.empty` | `acceptance` SCN-005, `store` empty |
| SCN-006 | No findable name → save anyway, address as name, nudge | `app.js` POST fallback branch, `links.fallbackName` | `app.js` `renderRow` `.fallback` + badge | `acceptance` SCN-006, `links` extractTitle null / fallbackName |
| SCN-007 | Non-link text → soft "save anyway?" warning | `app.js` POST returns `looksLikeLink` flag; still saves | `app.js` `looksLikeUrl` + `showNotLinkWarning`, submit handler | `acceptance` SCN-007, `links` looksLikeUrl |
| SCN-008 | Duplicate → no copy; flash existing | `app.js` POST duplicate branch, `store.findByUrl`, `links.sameLink`/`normalizeUrl` | `app.js` `doSave` duplicate branch, `render` flash | `acceptance` SCN-008, `links` normalize/sameLink, `store` findByUrl |
| SCN-009 | Links persist across sessions; never silently lost | `store` `_load`/`_persist` (atomic), `server.js` data file | (loads via GET on boot) | `acceptance` SCN-009, `store` restart + corrupt-file |

## Non-functional (see context/non-functional-backlog.md)
- NF-1 cross-device: not addressed (single-device, file-based).
- NF-2 large libraries: client-side search may need server paging/indexing later.
- NF-3 long text: handled cosmetically via CSS `word-break`/wrapping; revisit.
