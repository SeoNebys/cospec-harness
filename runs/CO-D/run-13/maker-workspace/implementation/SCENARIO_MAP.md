# Scenario → code mapping (for later-cycle impact analysis)

| Scenario | Behaviour | Primary code | Tests |
|----------|-----------|--------------|-------|
| SCN-001 | Quick save; auto-filled recognizable entry; newest-first list | src/metadata.js (fetch); src/store.js `create`; public/app.js `render` | e2e save flow; unit store |
| SCN-002 | Duplicate handling (canonical identity) | public/lib/canonical.js `canonicalKey`; src/store.js `create`/`findExisting` | unit canonical; unit store; e2e SCN-002 |
| SCN-003 | read vs archived independent; All/Unread/Archived | src/store.js `setState`; public/app.js `inView`,`controls`,`badge` | unit store; e2e SCN-003 |
| SCN-004 | Tags: chips, add/remove, single-tag filter | src/store.js `addTag`/`removeTag`; public/app.js `tagsHtml`,`toggleTag` | unit store; e2e SCN-004/005 |
| SCN-005 | Multi-tag filter (match all) | public/app.js `matchesTags` | e2e SCN-004/005 |
| SCN-006 | Edit title/description/address/note; address dup-guard; title fallback | src/store.js `update`; public/app.js `editRow`,`saveEdit` | unit store; e2e SCN-006/014 |
| SCN-007 | Review before finalizing a save | src/server.js `/api/preview`+`/api/bookmarks`; public/app.js `openReview`,`confirmCreate` | e2e save flow (smoke) |
| SCN-008 | Search query language within current view | public/lib/search.js; public/app.js `render` (scope/highlight) | unit search; e2e SCN-008 |
| SCN-009 | Sort newest/oldest/title | public/app.js `render` sort | (covered via UI) |
| SCN-010 | Load more; counts/search cover all | public/app.js `render` (visibleCount, matchIds) | (covered via UI) |
| SCN-011 | Two-line titles; clamped descriptions; long-note preview | public/styles.css; public/lib/format.js `isLongNote`; public/app.js `noteHtml` | unit format |
| SCN-012 | Relative time; date after ~a week (year when needed) | public/lib/format.js `whenLabel` | unit format |
| SCN-013 | Empty states; invalid-address & unreachable-page handling | public/app.js `render`/submit; src/store.js `create`; src/metadata.js | unit store; e2e SCN-013 |
| SCN-014 | Permanent delete (separate, confirmed) | src/store.js `remove`; public/app.js `delRow`,`deleteEntry` | unit store; e2e SCN-006/014 |
| SCN-015 | Bulk actions + select-all-matching; clear on view/search/tag change | src/store.js `bulk`; public/app.js `renderBulk`,`bulkApply`,`clearSelection` | unit store; e2e SCN-015 |
| SCN-016 | Title opens original page (new tab) | public/app.js `render` (title anchor) | e2e SCN-016 |
| SCN-017 | Capture preview image; show in review/edit only | src/metadata.js (og:image); src/store.js `create`; public/app.js `openReview`,`editRow` | (covered via UI) |

## Recorded for later cycles (not implemented)
- Local copy / archival snapshot of page content.
- Import existing browser bookmarks.
- Optional "Fetch details from a new address" action on edit (never auto-overwrite).
