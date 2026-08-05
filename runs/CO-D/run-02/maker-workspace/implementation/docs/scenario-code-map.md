# Scenario → code map

The basis for impact analysis in later cycles: which approved scenario is
realised by which code, and which tests pin it.

| Scenario | Behaviour | Core / store code | UI code (app.js) | Tests |
|---|---|---|---|---|
| SCN-001 | Find by any words, any order, word-start, across title/desc/note/site | `core.tokenize`, `core.itemMatches`, `core.haystack`, `core.selectView` | search box `#q`; `highlight()`; `render()` | core.test.js (finding block); ui.test.js "find it by its own note" |
| SCN-002 | Labels on cards; roundup row; clean by filed label; narrow within | `core.labelVocabulary`, `core.selectView` (tag filter) | `renderTagbar()`, `.tag`/`.filter` handlers, `.add-label` | core.test.js (roundups); ui.test.js "roundup by label" |
| SCN-003 | Two labels at once | — (parked) | — | — |
| SCN-004 | Quick save; autofill; own note searchable; label reuse; no duplicates | `store.add`, `core.findByUrl`, `core.resolveMetadata`, `core.canonicalLabel`, `core.normalizeUrl` | add panel, `#url` input handler, `saveBtn` | acceptance.test.js SCN-004; ui.test.js "add… own note", "duplicate paste" |
| SCN-005 | Inline note/label edits; Edit details for title/summary/link; link collision blocked | `store.update` (collision guard) | `openEditor`, inline `.note-edit`/`.add-label`/`.x`, `saveBtn` edit branch | acceptance.test.js SCN-005 |
| SCN-006 | Set aside (reversible), delete for good, Undo on both | `store.setAside`, `store.remove`, `store.insertAt`, `core.asideItems` | `setAside`/`bringBack`/`deleteForGood`, `renderAside`, toast | acceptance.test.js SCN-006; ui.test.js "set aside then delete-with-undo" |
| SCN-007 | Day-one welcome; everything-set-aside; no-results; search hidden on day one | `store.all`, `store.view`, `store.asideItems` | empty-state branch in `render()` | acceptance.test.js SCN-007; ui.test.js "day one" |
| SCN-008 | Unreadable page degrades gracefully; non-link nudge; link required; protocol tolerated | `core.asUrl`, `core.resolveMetadata` | `#url` input handler (`urlHint`) | core.test.js (asUrl, metadata); ui.test.js "not-a-link… degrades" |
| SCN-009 | Newest default; oldest/A–Z; remembered; applies to filtered views | `core.sortItems`, `core.selectView`, `store.getSort`/`setSort` | `#sortSel` handler, `render()` | core.test.js (ordering); acceptance.test.js SCN-009; ui.test.js "order control" |
| SCN-010 | Reading state (not label); flag on save; pile view; self-clearing; Undo | `core.unreadCount`, `core.selectView` (reading), `store.setUnread` | `renderReadBar()`, `#fUnread`, `.mark-read`/`.to-read-btn` | core.test.js (reading); acceptance.test.js SCN-010; ui.test.js "reading pile" |

## Files
- `src/core.js` — pure domain logic (SCN-001/002/004/008/009/010 + aside).
- `src/store.js` — state, persistence, operations (SCN-004/005/006/009/010).
- `src/app.js` — UI wiring for all scenarios.
- `index.html`, `styles.css` — shell and presentation.
- `tests/core.test.js`, `tests/acceptance.test.js`, `tests/ui.test.js`.
