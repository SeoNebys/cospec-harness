# Keepmark design record

## Decisions

- A small Node HTTP service and JSON data file keep this single-person app easy to run and make personal data durable without an external account or database service.
- Page metadata is gathered on the server with a short timeout. A valid link is always retained with host-based fallbacks when the page is unavailable or incomplete.
- Duplicate identity uses a normalized destination URL that removes fragments and recognized tracking parameters while retaining content-bearing parameters.
- Notes are stored as the person's lightweight shorthand and rendered safely. Only bold, bullet lists, and HTTP(S) links are interpreted.
- Search is evaluated locally for immediate feedback. Its parser applies `not`, then `and` (including adjacency), then `or`, with parentheses overriding precedence.
- Person-edited title and description flags protect writing when an address changes. The browser asks whether to retain those fields or refresh them.
- Only durable personal state is stored: bookmark data, Read later status, and sort preference. Search, filters, and expanded notes remain session state.
- The reversible archive, bulk actions, import/export, and display preferences are explicitly deferred to later cycles.

## Scenario-to-code map

- SCN-001–003, 024, 026–028, 033: `server.js` bookmark endpoints, `lib/core.js` URL/metadata rules, `public/app.js` save and edit flows.
- SCN-004–005, 029, 034: `lib/core.js` and `public/app.js` note rendering; card expansion in `app.js` and `styles.css`.
- SCN-006–009, 012, 035: label normalization in `lib/core.js` and `server.js`; label editing, suggestions, and filtering in `app.js`.
- SCN-010–018, 030–031: query compiler in `lib/core.js` and `public/app.js`; live-search states in `app.js`.
- SCN-019–022, 032: Read later mutation and views in `server.js` and `public/app.js`.
- SCN-023: persisted sorting in `server.js`; ordering and dropdown in `public/app.js`.
- SCN-025, 036: guarded deletion and empty collection state in `public/app.js`; deletion endpoint in `server.js`.
- SCN-037: atomic storage in `lib/store.js`, durable preference API in `server.js`, session-only view state in `app.js`.

## Test map

- `test/core.test.js`: URL identity, note formatting, label identity, query language, sorting, and metadata extraction.
- `test/store.test.js`: durable bookmarks and sort preference.
- Browser verification exercises saving fallback data, editing, labels, search, Read later, sorting, deletion, and empty states against the running application.
