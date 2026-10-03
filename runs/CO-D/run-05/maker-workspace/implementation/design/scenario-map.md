# Scenario → code map (cycle 1)

For impact analysis in later cycles. Paths are under `implementation/`.

| Scenario | Behaviour | Primary code | Tests |
|----------|-----------|--------------|-------|
| SCN-001 | Save with auto-filled editable details, tags, note | server.js `POST /api/bookmarks`, `POST /api/metadata`; public/app.js save form; lib/metadata.js | api.test.js, metadata.test.js |
| SCN-002 | Save when lookup fails; title falls back to link | lib/metadata.js (ok:false); server.js create title fallback; app.js failed box | metadata.test.js, api.test.js |
| SCN-003 | Duplicate address edits in place | lib/store.js `findByAddress`/`SAME_ADDRESS`; server.js create; app.js `findSaved` | api.test.js |
| SCN-004 | Reading-status views + move | server.js `PATCH`; app.js tabs/inTab/setStatus | api.test.js |
| SCN-005 | Edit a saved bookmark | server.js `PUT /api/bookmarks/:id`; app.js editSaved/loadIntoForm | api.test.js (create/update) |
| SCN-006 | Archive/restore orthogonal to status | server.js `PATCH archived`; app.js setArchived | api.test.js |
| SCN-007 | Delete permanently | server.js `DELETE`; app.js deleteSaved | api.test.js |
| SCN-008 | Per-view case-insensitive search | lib/search.js; app.js render filter | search.test.js |
| SCN-009 | Query language (#tag, "phrase", and/or/not, parens) | lib/search.js | search.test.js |
| SCN-010 | Click a tag to filter | app.js `.meta .chip` handler | (UI) |
| SCN-011 | Empty-state messages | app.js EMPTY + render | (UI) |
| SCN-012 | Invalid-link feedback | app.js badurl; server.js create/validate 400 | api.test.js |
| SCN-013 | Clean display, no residue; long text wraps | public/styles.css; app.js conditional note/meta | (UI) |
| SCN-014 | Sort, page size, paging, remembered | app.js sortItems/renderPager; server.js `PUT /api/prefs` | api.test.js |
| SCN-015 | Icon + preview image, fallbacks | lib/metadata.js; app.js favHtml/showMeta/thumb | metadata.test.js |
| SCN-016 | Tag suggestions with counts | app.js tag suggest | (UI) |
| SCN-017 | Bulk actions on selection/all matching | server.js `POST /api/bookmarks/bulk`; app.js bulkbar | api.test.js |
| SCN-018 | Markdown notes, rendered safely | app.js renderMarkdown (escapes first) | (UI; escaping unit-covered by design) |
| SCN-019 | Preserved copy + Internet Archive | lib/archive.js; server.js copy route; app.js openSnapshot | (integration; offline-safe) |
| SCN-020 | Saved searches | server.js `/api/searches`; app.js saved searches | api.test.js |
| SCN-021 | Import/export standard bookmark HTML | lib/bookmarksHtml.js; server.js import/export | bookmarksHtml.test.js, api.test.js |
| SCN-022 | Text-size preference, remembered | app.js textEl + body[data-ts]; server.js `PUT /api/prefs` | api.test.js (prefs) |

Cross-cutting: durable private storage (lib/store.js) underlies every scenario.
UI-only rows are exercised through the browser; core logic and API are covered
by the automated suites above.
</content>
