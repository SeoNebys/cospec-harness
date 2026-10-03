# Scenario → code map

Basis for impact analysis on future change requests. Paths are under
`implementation/`.

| Scenario | Behaviour | Server code | Client code | Shared | Tests |
|---|---|---|---|---|---|
| SCN-001 | Save with auto-filled, editable details + personal note; newest-first; rich entry | `src/metadata.js` (fetch/parse), `src/store.js` `create()` | `public/js/app.js` `fetchMeta`, `submitForm`, `renderItem` | `filters.js` `byNewest` | `metadata.test.js`, `store.test.js`, e2e SCN-001 |
| SCN-002 | Search title/description/note/address; live; highlight; no-match | — | `app.js` `render` (search box), `highlight` | `filters.js` `matchesQuery`, `searchText` | `filters.test.js`, e2e SCN-002 |
| SCN-003 | Several topics per link; filter by topic; combine with search | `store.js` topic normalisation | `app.js` `renderTopicsBar`, topic tags | `filters.js` `allTopics`, `filterItems` | `filters.test.js`, e2e SCN-003 |
| SCN-004 | Reading queue; default to-read; manual mark; status filter | `store.js` `setUnread()`, `POST /:id/unread` | `app.js` `setUnread`, status segmented control | `filters.js` `filterItems` (status) | `store.test.js`, `filters.test.js`, e2e SCN-004 |
| SCN-005 | Archive out of main view+search; separate searchable archive; restore; count | `store.js` `setArchived()`, `POST /:id/archived` | `app.js` `setArchived`, `archiveToggle`, `render` | `filters.js` `filterItems` (scope), `archivedCount` | `filters.test.js`, e2e SCN-005 |
| SCN-006 | Incomplete address blocks save; unreadable page still saveable w/ manual title; blank→host | `metadata.js` `fetchMetadata` (ok:false), `store.js` title fallback | `app.js` `isValidUrl`, `fetchMeta` warn path | — | `metadata.test.js`, `store.test.js`, e2e SCN-006 (×2) |
| SCN-007 | Empty/no-result states | — | `app.js` `render` empty branches | — | e2e SCN-007 |
| SCN-008 | Edit + delete (confirm permanent); preserve date/status/archived; long text wraps | `store.js` `update()`, `remove()`, `PUT`/`DELETE` | `app.js` `startEdit`, `cancelEdit`, `deleteItem` | — | `store.test.js`, e2e SCN-008 (×2) |
| SCN-009 | No duplicates across collection+archive; open existing to edit; edit conflict refused | `store.js` `create()`/`update()` dedup, HTTP 409 | `app.js` `submitForm` 409 handling | `filters.js` `normalizeUrl`, `sameUrl` | `filters.test.js`, `store.test.js`, e2e SCN-009 |

## Key files

- `src/server.js` — Express wiring, routes, guarded test reset.
- `src/store.js` — persistence + CRUD + dedup rules.
- `src/metadata.js` — page fetch + parse (+ host fallback).
- `public/shared/filters.js` — pure search/topic/status/scope/dedup logic.
- `public/js/app.js` — UI rendering and interactions.
- `public/index.html`, `public/css/styles.css` — markup and styling.
