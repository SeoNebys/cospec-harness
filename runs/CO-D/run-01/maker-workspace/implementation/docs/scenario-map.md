# Scenario-to-code map

| Scenarios | Production areas | Automated coverage |
|---|---|---|
| SCN-001, 012–014 | `server.js` preview/create routes; `public/app.js` add and review dialogs | `server.test.js`, `browser.test.js` |
| SCN-002–004, 016 | bookmark patch route; edit dialog, note toolbar, compact/expand rendering | `server.test.js`, `browser.test.js` |
| SCN-005, 007 | label picker, case-insensitive matching, label navigation | `browser.test.js` |
| SCN-006, 015 | `visibleBookmarks`, search input, no-results state | `browser.test.js` |
| SCN-008 | Read later toggle and collection view | `browser.test.js` |
| SCN-009 | archive/restore patch actions and view | `browser.test.js` |
| SCN-010 | delete confirmation and API route | `server.test.js`, `browser.test.js` |
| SCN-011, 019 | card opening behavior isolated from controls | browser behavior; manual external-page check |
| SCN-017, 018 | immutable snapshot behavior and selective refresh route/dialog | API structure; manual refresh comparison check |
