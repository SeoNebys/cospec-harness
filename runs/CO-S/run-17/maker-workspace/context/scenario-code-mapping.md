# Cycle 1 scenario-to-code mapping

| Scenario | Production behavior | Acceptance coverage |
|---|---|---|
| SCN-001 | `server.mjs` bookmark creation and metadata retrieval; `public/app.js` save flow | `e2e.cjs` empty-to-saved flow |
| SCN-002 | `public/app.js` inline details editor; PATCH route in `server.mjs` | `e2e.cjs` details correction |
| SCN-003 | `public/app.js` inline tag suggestions; `canonicalizeTags` | `e2e.cjs` existing Recipes suggestion |
| SCN-004 | `public/app.js` sidebar tag counts and filtered rendering | `e2e.cjs` Recipes sidebar filter |
| SCN-005 | `public/app.js` live title/description/note filtering and note-match explanation | `e2e.cjs` three search fields; `unit.test.mjs` matching |
| SCN-006 | `public/app.js` read-later buttons, view, counts, and flag clearing; PATCH route | `e2e.cjs` complete read-later journey |
| SCN-007 | `public/app.js` card click/keyboard navigation using `_blank` | `e2e.cjs` popup destination assertion |
| SCN-008 | address validation, metadata error, manual creation, duplicate response in `server.mjs`; recovery UI in `app.js` | `e2e.cjs` invalid, duplicate, unavailable metadata |
| SCN-009 | `normalizeNewTag`, `canonicalizeTags`, and explicit create suggestion in `app.js` | `e2e.cjs` Travel creation; unit tag tests |
| SCN-010 | `public/app.js` no-result state and clear control | `e2e.cjs` astronomy query and clear |
| SCN-011 | `public/app.js` dedicated note editor and PATCH note persistence | `e2e.cjs` note creation and immediate search |
| SCN-012 | title validation in `server.mjs` and inline editor validation in `app.js` | `e2e.cjs` blank title rejection |
| SCN-013 | long-content detection, compact card styling, expansion, and wrapping tags | `e2e.cjs` long content and six visible tags |
| SCN-014 | independent JSON persistence and unchanged card destination | `e2e.cjs` persisted fields after source-independent edits |

## Shared internal modules

- `implementation/lib/core.mjs`: address handling, tags, search predicates, HTML metadata extraction, and private-host detection.
- `implementation/server.mjs`: persistence, HTTP API, source-page retrieval, and static delivery.
- `implementation/public/app.js`: approved browser interactions and view-state rendering.
- `implementation/public/styles.css`: responsive presentation and approved visual boundary states.
