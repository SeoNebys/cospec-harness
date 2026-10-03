# Verification report — cycle 1

Date: 2026-09-18

## Result

All 20 approved scenario groups passed. The verification run included 14 Node unit/integration tests and a production browser journey using Chromium. Syntax checks also passed for every production JavaScript file.

| Scenario | Result | Primary evidence |
|----------|--------|------------------|
| SCN-001 | Pass | Browser: automatic editable details |
| SCN-002 | Pass | Browser + API: save and visible card |
| SCN-003 | Pass | Browser: card opens original URL in a new tab |
| SCN-004 | Pass | Browser: case-insensitive existing-tag suggestion plus new tag |
| SCN-005 | Pass | Browser: visible tag filter and return to All bookmarks |
| SCN-006 | Pass | Browser: live case-insensitive title, description, address, and tag search |
| SCN-007 | Pass | Browser + API: reversible Read later state |
| SCN-008 | Pass | Browser: All bookmarks and Read later views |
| SCN-009 | Pass | Browser + store: inline full-detail edit without reordering |
| SCN-010 | Pass | Browser + API: cancel and confirm removal |
| SCN-011 | Pass | Browser + metadata unit tests: malformed and unsupported addresses |
| SCN-012 | Pass | Browser + metadata tests: manual fallback and required title |
| SCN-013 | Pass | Store + browser: trailing-slash duplicate prevention and distinct pages |
| SCN-014 | Pass | Browser: named empty search state and clear action |
| SCN-015 | Pass | Browser: empty Read later guidance and return action |
| SCN-016 | Pass | Browser: compact, expand, and collapse detailed cards |
| SCN-017 | Pass | Browser: append batches and find items outside the visible batch |
| SCN-018 | Pass | Browser + store: invalid edits remain visible and saved record stays intact |
| SCN-019 | Pass | Browser: forced failed update preserves values and retry succeeds |
| SCN-020 | Pass | Browser + store: saved date, immutable created order, persistence, second browser context |

## Commands

- `npm test`
- `npm run test:e2e`
- `node --check` for the server, store, metadata reader, and browser application

## Coverage integrity

- Approved scenario files: 20
- Scenario index rows: 20
- Unique scenario IDs in the scenario-to-code map: 20
