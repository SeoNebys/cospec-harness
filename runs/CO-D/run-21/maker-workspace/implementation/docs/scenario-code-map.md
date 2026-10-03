# Scenario → code mapping (cycle 1)

| Scenario | Primary code |
|---|---|
| SCN-001 Save + auto-fill + note | `lib/preserve.js` capture/extract*, `lib/service.js` createBookmark, `public/app.js` startSave/confirmSave/renderSaveArea, formatNote |
| SCN-002 Tag suggestions + case-insensitive reuse | `lib/util.js` canonTag, `lib/service.js` dedupeTags, `public/app.js` wireTagSuggest/canonTag |
| SCN-003 Structured search | `public/app.js` tokenize/parseQuery/matches |
| SCN-004 Click tag to filter | `public/app.js` render (`.tag[data-tag]` handler) |
| SCN-005 Duplicate prevention | `lib/util.js` normalizeUrl, `lib/service.js` findByAddress/createBookmark/updateBookmark, `public/app.js` startSave |
| SCN-006 Edit in place | `lib/service.js` updateBookmark, `public/app.js` editFormHtml/saveEdit |
| SCN-007 Open page from card | `public/app.js` render (card click handler) |
| SCN-008 Unreadable save + retry | `lib/service.js` createBookmark/retry, `public/app.js` retry, preservedLineHtml |
| SCN-009 Empty states + clear search | `public/app.js` render (empty branch), clearSearch |
| SCN-010 Long text clamp + show more | `styles.css` clamps, `public/app.js` noteNeedsClamp/expanded |
| SCN-011 Sort + paging | `public/app.js` computeMatched/render (paging), applyPrefs |
| SCN-012 Reading status | `lib/service.js` updateBookmark(read), `public/app.js` toggleRead, statusFilter, dReadLater |
| SCN-013 Archive/restore vs delete | `lib/service.js` updateBookmark(archived)/deleteBookmark, `public/app.js` setArchived/del, locationFilter |
| SCN-014 Preservation + Internet Archive | `lib/preserve.js`, `lib/store.js` snapshots, `lib/service.js` createBookmark/retry/sendToArchive, server `/copy` |
| SCN-015 Bulk actions | `lib/service.js` bulk, `public/app.js` renderBulkBar/openTagPicker |
| SCN-016 Saved searches | `lib/store.js` saved searches, `public/app.js` saveCurrentSearch/makeMultiTag/renderSavedSearches |
| SCN-017 Import/export | `lib/netscape.js`, `lib/service.js` importNetscape/exportNetscape, server `/import` `/export` |
| SCN-018 Preferences | `lib/store.js` setPrefs, server `/prefs`, `public/app.js` openPrefs/applyPrefs |

Non-functional: responsive layout — `styles.css` media query; persistence — `lib/store.js`.
