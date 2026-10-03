# Scenario-to-code mapping — cycle 1

| Scenario | Production behavior | Acceptance coverage |
|---|---|---|
| SCN-001, SCN-006 | `server.js` metadata endpoint; `app.js` save handler | `tests/bookmarks.spec.js` saving group |
| SCN-002, SCN-007 | `app.js` tag editor | tagging group |
| SCN-003, SCN-008 | `app.js` filtering and `render` empty states | search and empty-view groups |
| SCN-004 | `app.js` read-later action and view projection | reading-list group |
| SCN-005, SCN-009 | `app.js` edit/archive/restore/delete actions and dialogs | management group |
| SCN-010 | `styles.css` bookmark title/address rules | long-details test |
| SCN-011 | persistent snapshot model in `app.js` | metadata stability test |
