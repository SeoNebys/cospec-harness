# Scenario → code mapping — Cycle 1

Basis for impact analysis on future change requests.

| Scenario | Behaviour | Code | Tests |
|---|---|---|---|
| SCN-001 | Save by paste; capture real title | `src/app.js` POST /api/bookmarks; `src/titleService.js`; `src/store.js` create; UI `public/app.js` save()/renderItem() | `test/acceptance.test.js` SCN-001; `test/shared.test.js` extractTitle; `test/store.test.js` create |
| SCN-002 | Live search over title + host | `src/shared.js` matchesQuery/filterBookmarks; UI search input + renderList()/highlight() | `test/shared.test.js` matchesQuery, filterBookmarks |
| SCN-003 | Tag browse; multi-tag membership | `src/shared.js` deriveTags/filterBookmarks; UI renderTags()/tag chips | `test/shared.test.js` deriveTags, filterBookmarks |
| SCN-004 | In-the-moment tag prompt + autocomplete | `src/app.js` PATCH tags; `src/store.js` update(tags); UI wireTagInput()/addTag()/removeTag() | `test/acceptance.test.js` SCN-004; `test/store.test.js` tags dedup |
| SCN-005 | Empty states (new library / no matches) | `src/store.js` empty load; UI showEmpty()/renderList() | `test/acceptance.test.js` SCN-005; `test/store.test.js` empty file |
| SCN-006 | Title-not-found / duplicate / non-link | `src/app.js` POST (looksLikeUrl 400, findByUrl 409, needsTitle); `src/store.js` findByUrl/update(title); UI addName()/showDuplicate() | `test/acceptance.test.js` SCN-006 ×3; `test/shared.test.js` looksLikeUrl/canonicalUrl/extractTitle |
| SCN-007 | Offline save; title resolved later | `src/app.js` POST (needsTitle) + POST /:id/refresh-title; UI tryRefresh()/refreshMissingTitles() | `test/acceptance.test.js` SCN-007 |
| SCN-008 | Instant delete + undo | `src/app.js` DELETE; UI startDelete()/commitPending()/undo()/showToast() | `test/acceptance.test.js` SCN-008; `test/store.test.js` remove |

## Notes
- NF-1 (search fast at scale): current search is a linear in-memory filter —
  fine for typical personal libraries; revisit if very large.
- NF-2 (persistence): JSON file store (`test/store.test.js` persistence test).
