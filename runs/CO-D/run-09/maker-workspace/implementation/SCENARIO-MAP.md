# Scenario → code mapping (Cycle 1)

Basis for impact analysis in later cycles. Paths are under `implementation/`.

| Scenario | Behaviour | Primary code | Tests |
|----------|-----------|--------------|-------|
| SCN-001 | Save with auto-filled details | server `POST /api/bookmarks`, `lib/metadata.fetchMetadata`, app `openSaveFlow/startSaveFill/onConfirm` | acceptance "save a link"; |
| SCN-002 | Reuse previous labels | app `renderSuggest` | acceptance (label field) |
| SCN-003 | Re-paste opens existing | app `openSaveFlow` dup check; server 409 on create; `store.normUrl` | acceptance "re-pasting"; store.test |
| SCN-004 | Edit incl. address + clash safeguard | server `PUT /api/bookmarks/:id`; app `onConfirm` clash UI | store.test (normUrl) |
| SCN-005 | Open original page (title/icon, new tab) | app card `.openlink` | (manual/visual) |
| SCN-006 | Broad live search | `public/query.js` compile/match; app search wiring | query.test; acceptance |
| SCN-007 | #labels, phrases, AND/OR/NOT, parens | `public/query.js` | query.test; acceptance |
| SCN-008 | Change read status | server `PUT` / `POST /api/bulk`; app status buttons | acceptance "mark read" |
| SCN-009 | Focus by status (All/To read/Finished) | app `renderFilter`, `render` | acceptance "Finished view" |
| SCN-010 | Empty state | app `render` empty branch | acceptance "empty state" |
| SCN-011 | Unreadable page still savable | `lib/metadata.fetchMetadata` readable=false; app fill | acceptance "unreadable" |
| SCN-012 | Non-link refused | `store.looksLikeLink`; server 400; app note | store.test; acceptance |
| SCN-013 | Long content tidy | CSS `.title/.desc/.note` clamps; app note expander | (visual) |
| SCN-014 | Sort + remembered | server `PUT /api/prefs`; app `renderSort/sortCmp` | acceptance "sort persist" |
| SCN-015 | Click label to filter | app `[data-label]` handler | acceptance "clicking a label" |
| SCN-016 | Bulk select + actions | server `POST /api/bulk`; app `renderBulk` | acceptance "bulk" |
| SCN-017 | Archive vs delete | server `bulk` archive/restore/delete, DELETE; app archived view | acceptance "archive/restore" |
| SCN-018 | Saved searches (collections) | server `/api/collections`; app `renderCollections` | acceptance "collection" |
| SCN-019 | Formatted notes + preview/expander | `public/format.js`; app note toolbar/preview | format.test; (visual) |
| SCN-020 | Preserved copy / PDF / Internet Archive | `lib/metadata` capture/IA; server snapshot/capture; app copy row | acceptance "preserved copy" |
| SCN-021 | Import/export bookmark HTML | `lib/bookmarksHtml`; server import/export; app tools | bookmarksHtml.test; acceptance |
| SCN-022 | Display prefs (text size, items shown) | server `prefs`; app display panel + pagination | acceptance "display persist" |

## Non-functional (context/non-functional-backlog.md)
- NF-001 calm visual hierarchy — `public/styles.css` (title/desc/labels/icon prominent; url/note quiet).
- NF-002 stay fast at scale — client-side filtering + pagination; JSON store.
