# Scenario → code mapping (cycle 1)

Basis for later-cycle impact analysis. "Tested by" points at tests/core.test.mjs cases.

| Scenario | Behaviour | Code | Tested by |
|---|---|---|---|
| SCN-001 | Paste → readable entry, newest on top | resolver.resolveMetadata, store.addFromUrl, app.render (save box), sort default | (UI) + sort.test |
| SCN-002 | No duplicates; ignore tracking junk; keep distinct pages | model.normalizeUrl, library.findDuplicate | normalize/dedup tests |
| SCN-003 | Open a link to fix title/summary; Done/Cancel/Esc | app edit panel, store.updateFields | (UI) |
| SCN-004 | Several labels; reuse existing (case-insensitive) | labels.createLabelIndex, app label editor | label-index tests |
| SCN-005 | Pull up a label; multi-label appears under each | library.visibleItems('label'), app filter bar | visible-items tests |
| SCN-006 | Multi-word AND search, quotes = phrase, highlight | search.tokenize/matches/highlight | search tests |
| SCN-007 | To-read state; check off; undo; sticky save default | store.setToRead/setRead, library.visibleItems('toread'), app | visible-items tests |
| SCN-008 | Unreadable page → keep it, flag needsName, retry once | resolver.resolveMetadata (fallback), store.addFromUrl | resolver-fallback test |
| SCN-009 | Non-link → gentle inline error | model.looksLikeLink, app | looksLikeLink test |
| SCN-010 | Friendly empty states | app.render empties | (UI) |
| SCN-011 | Delete + Undo toast (lingers) | store.deleteItem/restore, app toast | (UI) |
| SCN-012 | Put away = archived; hidden from list/search/labels/to-read; back room | library.visibleItems, store.setArchived | visible-items tests |
| SCN-013 | Personal note on card; searchable; long note truncates | search haystack, app note block | search-note test |
| SCN-014 | Sort newest/oldest/a–z | sort.sortItems | sort tests |
| SCN-015 | Import file: preview, keep titles, folders→labels (case-merge, nested, skip containers), keep dates, skip dupes, bulk | importer.parseBookmarksHtml/planImport | importer tests |
| SCN-016 | Export standard file; labels→folders; notes→DD; round-trips | exporter.buildBookmarksHtml | exporter + round-trip tests |
