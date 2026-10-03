# Scenario ↔ code mapping — Cycle 1

Basis for judging impact scope on future change requests.

| Scenario | Behaviour | Code | Tests |
|----------|-----------|------|-------|
| SCN-001 | Save with auto-filled details, tags, note; empty state | `public/js/app.js` (getDetails, save, collectForm, render/cardHtml); `server.js` POST /api/bookmarks, GET /api/fetch-details; `src/metadata.js`; `src/store.js` create | unit: store, metadata; e2e: save.spec |
| SCN-002 | Duplicate on save → load existing to update; edit any bookmark; match rule | `public/js/urlkey.js`; `public/js/app.js` (save duplicate check, enterEditMode); `server.js` PUT /api/bookmarks/:id; `src/store.js` update | unit: urlkey; e2e: duplicate-edit.spec |
| SCN-003 | One search box across all fields; case-insensitive; multi-word AND; no-match state | `public/js/search.js` (tokenize/buildQuery, word); `public/js/app.js` render filter | unit: search; e2e: search.spec |
| SCN-004 | Precise search: #tag, "phrase", AND/OR/NOT, parentheses, lenient | `public/js/search.js` (parseOr/parseAnd/parseUnary/parseAtom, tag/phrase) | unit: search; e2e: search.spec |
| SCN-005 | Read later lane; flag in All; Mark as read | `public/js/app.js` (setLater, inView 'later', cardHtml flag/actions) | e2e: lanes.spec |
| SCN-006 | Archive hides from All + normal search; Archived view searchable; restore | `public/js/app.js` (setArchived, inView 'archived', view-scoped search) | e2e: lanes.spec |
| SCN-007 | Details lookup fail / invalid link → saving not blocked | `public/js/app.js` (getDetails ok:false + invalid url); `server.js` fetch-details; `src/metadata.js` fetchMetadata | unit: metadata; e2e: save.spec |
| SCN-008 | Tailored empty states per view | `public/js/app.js` (emptyMessage, render) | e2e: save.spec, lanes.spec |
| SCN-009 | Permanent delete with inline confirmation | `public/js/app.js` (confirmingDeleteId, reallyDelete, cardHtml confirm); `server.js` DELETE; `src/store.js` remove | e2e: delete.spec |
