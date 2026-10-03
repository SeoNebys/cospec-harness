# Scenario-to-code map

| Scenario | Primary implementation | Primary tests |
|---|---|---|
| SCN-001 Save enriched bookmark | `lib/bookmarks.js`, `lib/metadata.js`, `public/app.js` save flow | `bookmarks.test.js` save test; browser acceptance save flow |
| SCN-002 Active duplicate update | `BookmarkService.save/refresh`, duplicate notice in `app.js` | `bookmarks.test.js` duplicate test; `api.test.js`; browser acceptance duplicate flow |
| SCN-003 Open card in new tab | card overlay link in `app.js`, card/link rules in `app.css` | browser acceptance popup assertion |
| SCN-004 Personal labels | `BookmarkService.addLabel`, label editor/card tags in `app.js` | label service test; browser acceptance label flow |
| SCN-005 Sidebar label filtering | `uniqueLabels`, `matchesBookmark`, `renderSidebar` | `domain.test.js` combined filter test; browser acceptance |
| SCN-006 Forgiving search | `matchesBookmark`, search input/rendering in `app.js` | `domain.test.js`; browser acceptance uppercase description search |
| SCN-007 Read-later status | `BookmarkService.setRead`, card status actions | reversible status service test; browser acceptance |
| SCN-008 Archive and restore | `archive/restore`, archive view and notices in `app.js` | archive service test; `api.test.js`; browser acceptance |
| SCN-009 Malformed URL | `lib/urls.js`, client validation and field error | malformed URL service test; browser acceptance |
| SCN-010 Metadata unavailable | `MetadataClient`, save error presentation in `app.js` | metadata failure service test; browser acceptance |
| SCN-011 Empty search result | `renderEmpty`, clear-search action | browser acceptance no-results flow |
| SCN-012 Duplicate label | case-insensitive `addLabel`, label feedback | label service test; browser acceptance |
| SCN-013 Reversible reading status | `setRead`, dynamic status action | status service test; browser acceptance |
| SCN-014 Archived duplicate | duplicate lookup across all records, restore-refresh action | archived duplicate service test; browser acceptance archive/restore path |
| SCN-015 Long content | complete stored fields, `matchesBookmark`, CSS line clamping and tag wrapping | long-content service test; search unit test; browser layout inspection |

## Cross-cutting files

- `server.js`: HTTP/API routing and static delivery.
- `lib/store.js`: persistent bookmark identity and atomic writes.
- `public/domain.js`: case-insensitive search and label aggregation shared by browser behavior and unit tests.
- `test/api.test.js`: request/response integration across key state transitions.
