# Scenario-to-code map

| Scenario | Production behavior | Acceptance coverage |
|---|---|---|
| SCN-001 | `server.js#createBookmark`, `lib/metadata.js`, capture/editor views | `acceptance.test.js`, `metadata.test.js` |
| SCN-002 | collection cards and action menu in `public/app.js`; update API | `acceptance.test.js` |
| SCN-003 | update API preserves metadata while changing address | `acceptance.test.js` |
| SCN-004 | `lib/tags.js`; tag editor/suggestions in `public/app.js` | `tags.test.js`, `acceptance.test.js` |
| SCN-005 | tag pills place `#tag` into live search | browser verification; search unit tests |
| SCN-006 | `lib/search.js`; live search and note excerpts | `search.test.js`, `acceptance.test.js` |
| SCN-007 | compact and explicit parsers in `lib/search.js` | `search.test.js`, `acceptance.test.js` |
| SCN-008 | notes editor, formatter, preview in `public/app.js`; note persistence | `acceptance.test.js`; browser verification |
| SCN-009 | `lib/url.js#canonicalAddress`; create API duplicate branch | `url.test.js`, `acceptance.test.js` |
| SCN-010 | create API metadata-failure fallback; editor notice | `acceptance.test.js` |
| SCN-011 | `lib/url.js#prepareAddress`; capture inline error | `url.test.js`, `acceptance.test.js` |
| SCN-012 | incomplete versus empty result responses and UI states | `search.test.js`, `acceptance.test.js` |
| SCN-013 | card line clamps and expandable tag rendering | `acceptance.test.js`; browser verification |
| SCN-014 | case-insensitive normalization and duplicate-tag feedback | `tags.test.js`; browser verification |
| SCN-015 | persisted metadata and no background destructive refresh | `acceptance.test.js` |
