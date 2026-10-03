# Scenario to code map

| Scenario | Primary production code | Automated coverage |
|---|---|---|
| SCN-001 | `src/bookmarks.mjs`, `server.mjs`, `public/app.js` save composer | API and browser save tests |
| SCN-002 | URL identity and duplicate preview; edit panel | API duplicate/update and browser tests |
| SCN-003 | list filtering in API and client | API search and browser search tests |
| SCN-004 | edit panel and tag helpers | API update and browser management tests |
| SCN-005 | client `openBookmark`, resolve endpoint | API resolve and browser new-tab tests |
| SCN-006 | read-later endpoint, sidebar filter | API toggle and browser shortlist tests |
| SCN-007 | client tag sidebar and API tag filtering | API tag query and browser tag tests |
| SCN-008 | edit-panel delete controls and DELETE endpoint | Browser delete test |
| SCN-009 | page capture, resolve fallback, archive reader | API archive fallback and browser reader tests |
| SCN-010 | URL validation, unreachable preview, pending retry | Unit/API recovery tests |
| SCN-011 | client/API zero-result state | API and browser no-results tests |
| SCN-012 | canonical URL normalization | Unit and API referral-duplicate tests |
| SCN-013 | card line clamping and uncut edit values | Browser long-content test |
| SCN-014 | case-insensitive tag normalization | Unit/API/browser tag tests |
| SCN-015 | delete confirmation cancellation | Browser cancellation test |
