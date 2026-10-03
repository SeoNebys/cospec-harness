# Scenario-to-code map

- SCN-001, SCN-003, SCN-015, SCN-016, SCN-019: `server.js`, `lib/urls.js`, save form in `public/app.js`
- SCN-002: bookmark link rendering in `public/app.js`
- SCN-004, SCN-005, SCN-006, SCN-012, SCN-020: label endpoints and card/filter rendering in `server.js` and `public/app.js`
- SCN-007, SCN-011, SCN-013, SCN-014, SCN-017, SCN-018: `lib/search.js`, `public/search.js`, search rendering in `public/app.js`
- SCN-008, SCN-009, SCN-025: status endpoint, tabs, counters, and empty states in `server.js` and `public/app.js`
- SCN-010, SCN-021, SCN-026: atomic edit endpoint and editor in `server.js` and `public/app.js`
- SCN-022, SCN-023: `lib/capture.js`, snapshot endpoints, dialog, and retry state
- SCN-024: compact/expanded card rendering and styles

Unit tests cover URL identity, search parsing, and readable-copy sanitization. Browser verification exercises the integrated scenario flows.
