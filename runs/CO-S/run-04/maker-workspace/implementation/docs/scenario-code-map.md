# Scenario ↔ code mapping (cycle 1)

Basis for impact analysis in later cycles.

| Scenario | Behaviour | Primary code | Tests |
|----------|-----------|--------------|-------|
| SCN-001 | Save link + auto-fill details | `app.mjs` save handler + `resolveDetails`; `server.mjs` `/api/metadata`; `src/metadata.mjs` `parseMetadata` | `tests/unit/metadata.test.mjs`; `tests/acceptance/save.spec.js` |
| SCN-002 | Edit URL/title/description (+ optional re-fetch) | `app.mjs` `editCard`, `saveEdit` | `tests/acceptance/edit.spec.js` |
| SCN-003 | Tags (pick or type) + private Markdown note | `app.mjs` `organizeCard`, `saveOrganize`, draft helpers; `markdown.mjs` | `tests/unit/markdown.test.mjs`; `tests/acceptance/organize.spec.js` |
| SCN-004 | Filter by tags (AND narrowing), combine with search | `app.mjs` `renderFilterBar`, `visibleBookmarks` | `tests/acceptance/find.spec.js` |
| SCN-005 | Search query language | `search.mjs` `buildMatcher`, `toRecord` | `tests/unit/search.test.mjs`; `tests/acceptance/find.spec.js` |
| SCN-006 | Read-later marker + view | `app.mjs` `inView`, readlater action, tabs | `tests/acceptance/readlater.spec.js` |
| SCN-007 | Archive (move) + restore | `app.mjs` `inView`, archive/restore actions | `tests/acceptance/archive.spec.js` |
| SCN-008 | Resilient save on fetch failure | `server.mjs` error path; `app.mjs` `resolveDetails` error branch, retry | `tests/acceptance/fetch-failure.spec.js` |
| SCN-009 | Duplicate handling | `model.mjs` `sameLink`/`findDuplicate`; `app.mjs` save handler, `revealBookmark` | `tests/unit/model.test.mjs`; `tests/acceptance/duplicate.spec.js` |
| SCN-010 | Partial details / long text | `styles.css` `.desc` clamp; `normalCard` conditional fields | `tests/acceptance/boundary.spec.js` |
| SCN-011 | Empty states + invalid input | `model.mjs` `isValidLink`; `app.mjs` `renderEmpty`, save handler | `tests/unit/model.test.mjs`; `tests/acceptance/empty-invalid.spec.js` |
| SCN-012 | Browser-local persistence | `store.mjs`; `app.mjs` `persist` | `tests/acceptance/persistence.spec.js` |

## Notes
- The `/api/metadata` endpoint is mocked/served locally in acceptance tests via
  a small fixture server so tests do not depend on the public internet.
