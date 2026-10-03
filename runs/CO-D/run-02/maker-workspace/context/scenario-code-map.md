# Scenario → code map (cycle 1)

For later-cycle impact analysis. Paths are under `implementation/`.

| SCN | Behaviour | Server | Frontend | Tests |
|-----|-----------|--------|----------|-------|
| SCN-001 | Save with reviewed metadata | `POST /api/metadata`, `POST /api/bookmarks`, `pagefetch.fetchMetadata` | `saver` submit, `openReview`, `saveReview` | acceptance SCN-001 |
| SCN-002 | No duplicates; open existing | dup check in `/api/metadata` & `/api/bookmarks` | `jumpToExisting` | acceptance SCN-001/002 |
| SCN-003 | Edit address/title/desc/note/tags | `PUT /api/bookmarks/:id` | `openReview(…, true)` / `saveReview` | acceptance (edit paths) |
| SCN-004 | Tags: reuse + type-to-filter + create | tag cleaning in create/update | `buildTagInput` | acceptance SCN-004 |
| SCN-005 | Search across all fields + operators | (client) | `public/query.js`, `currentVisible` | unit query.test, acceptance SCN-005 |
| SCN-006 | Reading list add / mark read | `/api/bookmarks/:id/status`, `/api/bulk` | card actions, `setStatus` | acceptance SCN-006 |
| SCN-007 | Archive hide + restore | `status`/`bulk` archived flag | `inView`, card actions | acceptance SCN-007 |
| SCN-008 | Three views + scoped search | (client) | `inView`, `render` | acceptance SCN-008 |
| SCN-009 | Permanent delete w/ confirm | `DELETE /api/bookmarks/:id` | card Delete inline confirm | acceptance SCN-009 |
| SCN-010 | Saved / updated dates | `created`/`updated` fields | `.card-dates` | acceptance SCN-010 |
| SCN-011 | Invalid link declined | 400 in `/api/metadata` | saver handler | acceptance SCN-011 |
| SCN-012 | Empty states | — | `render` empty branches | acceptance SCN-012 |
| SCN-013 | Personal note + formatting | `note` field | `renderNote`, note toolbar | acceptance SCN-013 |
| SCN-014 | Open page / click-tag filter | — | `title`/`card-preview` links, `filterByTag` | acceptance SCN-014 |
| SCN-015 | Sort | (client) | `sortCmp`, sort control | acceptance SCN-015 |
| SCN-016 | Bulk select + actions | `POST /api/bulk` | `renderBulkBar`, `bulk` | acceptance SCN-016 |
| SCN-017 | Saved searches | `/api/saved` | `renderSaved`, save form | acceptance SCN-017 |
| SCN-018 | Auto copy + manual IA | `makeSnapshot`, `submitInternetArchive`, `/copy` | `copyPanel`, `makeCopy` | acceptance SCN-018, api test |
| SCN-019 | Import / export | `/api/import`, `/api/export`, `importexport.js` | Import/Export panel | unit importexport, acceptance SCN-019 |
| SCN-020 | Display preferences | `/api/preferences` | Preferences panel, paging | acceptance SCN-020 |

Cross-cutting: `src/store.js` (persistence), `src/urlutil.js` (URL/tag helpers),
`public/styles.css` (calm UI, NFR-002), responsive layout (NFR-001).
