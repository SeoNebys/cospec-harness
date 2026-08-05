# Scenario → code mapping (Phase 2, Cycle 1)

Basis for impact analysis in later cycles. Paths under implementation/.

| Scenario | Primary code | Notes |
|----------|--------------|-------|
| SCN-001 Save + auto-fill + review | js/pageReader.js, js/app.js (openComposer/saveComposer), js/store.js (addBookmark) | pre-save review composer |
| SCN-002 Labels + type-ahead + no-dupes | js/store.js (labels registry, canonicalLabel), js/labelInput.js | reused in composer & editor |
| SCN-003 Find: browse/search/AND | js/store.js (applyFilter), js/app.js (sidebar, search) | full-text over title/desc/url/note/labels |
| SCN-004 Sort | js/store.js (sortBookmarks), js/app.js (sort control) | newest default |
| SCN-005 Notes + search | js/store.js (note field, applyFilter includes note) | |
| SCN-006 Visit vs edit | js/app.js (card click=visit, pencil=editor) | |
| SCN-007 Duplicate detection | js/store.js (normalizeUrl, findByUrl) | tracking-aware |
| SCN-008 Delete + undo | js/store.js (deleteBookmark), js/app.js (undo toast) | editor-only |
| SCN-009 Set aside | js/store.js (setAside/putBack), js/app.js (tabs, search opt-in) | |
| SCN-010 Combine all/any/not | js/store.js (applyFilter), js/app.js (filter bar) | |
| SCN-011 To-read pile | js/store.js (unread flag, markRead), js/app.js (To read tab, peek) | |
| SCN-012 Bulk actions | js/app.js (selection mode, action bar), js/store.js (bulk helpers) | guarded bulk delete |
| SCN-013 Card visuals | js/app.js (renderCard), styles.css (.card/.thumb/.fav) | placeholder tile fallback |
| SCN-014 Forgiving save | js/store.js (looksLikeUrl), js/pageReader.js (failure), js/app.js (composer) | title optional |
| SCN-015 Empty/overflow | js/app.js (empty states), styles.css (line-clamp), labels "+N more" | model lossless |
| SCN-016 Import | js/import.js (parseNetscapeBookmarks), js/app.js (import flow), js/store.js (importBookmarks) | folders->labels, dates |
| SCN-017 Saved views | js/store.js (views, addView/removeView), js/app.js (renderViews, applyView, Save-this-view button, dirtyView) | Cycle 2. Captures full filter incl. query; live; persisted. |
| SCN-018 Keep a copy | js/capture.js (capturePage, archiveUrlFor), js/store.js (copy field, matchesQuery+copyText, copyMatchSnippet, setCopy), js/app.js (captureInBackground, copyChip, openCopyReader, why-match snippet) | Cycle 3. Client build: capture abstraction (server piece = production). Readable copy A; C fallback; B deferred. |

## Tests
| Test file | Covers |
|-----------|--------|
| tests/logic.test.js | normalizeUrl, findByUrl, canonicalLabel, applyFilter (all/any/not/search+notes), sortBookmarks, looksLikeUrl, import parse, read-status defaults |
| tests/run.html | browser runner for the above (no build step) |
