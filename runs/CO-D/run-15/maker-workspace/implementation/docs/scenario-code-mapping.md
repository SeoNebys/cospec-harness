# Scenario-to-code mapping

| Scenario | Production implementation | Automated evidence |
|---|---|---|
| SCN-001 Save with details | `server.js` POST `/api/bookmarks`; `lib/metadata.js`; `public/app.js` save form and cards | `test/api.test.js` save test; `e2e/bookmarks.spec.js` |
| SCN-002 Exact duplicate | `lib/database.js#getBookmarkByCanonical`; create route duplicate response; client highlight/toast | `test/api.test.js` save test |
| SCN-003 Inline free-form tag | tag routes; database tag association; `openTagEntry` | `test/database.test.js`; browser journey |
| SCN-004 Multiple/suggested tags | case-insensitive `tags.name_key`; tag suggestions in `openTagEntry` | `test/database.test.js` |
| SCN-005 Word and tag search | `StowDatabase#listBookmarks`; search field and visible tag filters | `test/database.test.js` |
| SCN-006 Flag and Read later view | bookmark `read_later`; view query; checkbox and counted tab | database test; browser journey |
| SCN-007 Mark as read | bookmark patch; focused-view `Mark as read` action | database test; browser journey |
| SCN-008 Formatted searchable note | `lib/text.js`; note columns; note editor/preview/card rendering | text, database, and API tests; browser journey |
| SCN-009 Same-page editing | bookmark patch same-page branch; focused edit dialog | `test/api.test.js` edit test |
| SCN-010 Private sign-in | seeded user, password/session modules and login screen | database and API auth tests; browser journey |
| SCN-011 Unreadable fallback | `gatherMetadata` failure result; unavailable card state | `test/api.test.js` save test |
| SCN-012 Tracking duplicate | `lib/urls.js#canonicalizeUrl`; canonical unique key | URL and API save tests |
| SCN-013 Invalid URL | `parseWebUrl`; create-route error; retained save-form value | URL/API tests; browser journey |
| SCN-014 Zero results | list query; `renderBookmarks` filtered empty state | database test; browser journey |
| SCN-015 Remove one tag | DELETE tag association route and chip control | database test |
| SCN-016 Collapsed long note | `.note-content.collapsed`; expansion state; full `note_plain` search | text/database tests |
| SCN-017 Different-page warning | bookmark patch conflict/strategy branches; page-change dialog | API edit test |
| SCN-018 Non-revealing login failure | authentication route; login form preservation/reset | API auth test; browser journey |
| SCN-019 Permanent delete | cascading bookmark deletion; confirm dialog | API lifecycle test |
| SCN-020 Set aside/restore | `archived` field and view; archive/restore controls | database/API tests; browser journey |
| SCN-021 Load in batches | limit/offset query; full-search-before-limit; Load more append | database batching test |
| SCN-022 Persistent/expired session | hashed sessions and expiry; `captureDraft`/`restoreDraft` | API session test; browser session flow verified in Phase 3 |

## Test layers

- `test/urls.test.js` and `test/text.test.js`: focused parsing, normalization, and sanitization units.
- `test/database.test.js`: collection-state, search, tag, view, and batching integration against in-memory SQLite.
- `test/api.test.js`: authenticated HTTP workflows, metadata outcomes, edit boundaries, lifecycle, and session protection.
- `e2e/bookmarks.spec.js`: Chromium journey through sign-in, validation, saving, tagging, Read later, formatted notes, search, set-aside, and restore.
