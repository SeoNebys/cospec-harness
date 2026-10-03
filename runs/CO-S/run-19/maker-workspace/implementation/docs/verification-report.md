# Verification report — cycle 1

Date: 2026-09-24

## Result

All 22 approved scenarios pass. The verification command completed with 16 internal tests and 5 browser acceptance tests passing. The production dependency audit reports zero known vulnerabilities.

## Scenario evidence

| Scenario | Verified behavior | Evidence |
|---|---|---|
| SCN-001 | One-field save captures recognizable title, description, source, saved time, and preview image | capture test; save form/browser rendering test |
| SCN-002 | Details edit drawer keeps library context and updates the card with confirmation | browser acceptance test |
| SCN-003 | Live, partial, case-insensitive search across title, description, and website | store test; browser acceptance test |
| SCN-004 | Multiple tags, new tags, matching suggestions, and usage counts | store test; browser acceptance test |
| SCN-005 | Visible tag filtering combines with all four supported sort orders | store test; browser acceptance test |
| SCN-006 | Named saved view preserves and restores query, tag, sort, and results | store test; browser acceptance test |
| SCN-007 | Direct Read later action, queue, and Mark as read retain the bookmark | lifecycle test; browser acceptance test |
| SCN-008 | Menu Archive and Restore move an unchanged bookmark reversibly | lifecycle test; browser acceptance test |
| SCN-009 | Named irreversible warning precedes permanent deletion, with no Archive move | deletion test; browser acceptance test |
| SCN-010 | Dedicated reader exposes captured details, image, text, capture date, and original URL when live page is unavailable | capture test; reader browser test |
| SCN-011 | Tracking parameters do not create a duplicate or overwrite its saved details/date | URL and service tests |
| SCN-012 | Invalid address remains editable with inline full-address example and no save | URL test; browser acceptance test |
| SCN-013 | Capture failure saves nothing until explicit manual fallback, then marks no saved copy | capture/service tests; browser acceptance test |
| SCN-014 | No-match message is non-destructive and clearing restores the library | store test; browser empty-state behavior |
| SCN-015 | Removing a final tag preserves all bookmark details and removes the unused tag | store test |
| SCN-016 | Empty saved-view name leaves dialog/configuration intact and adds nothing | store test; browser acceptance test |
| SCN-017 | Keep bookmark closes deletion warning without changing card or counts | browser acceptance test |
| SCN-018 | Empty title is rejected in-place; empty description is accepted | service test; browser acceptance test |
| SCN-019 | 347 items paginate eight at a time; cards clamp long text and collapse extra tags without data loss | store scale test; browser compact-card/reader test |
| SCN-020 | SQLite retains details, tags, queue/archive state, views, and page copies across reopen; UI state survives reload | persistence test; browser reload test |
| SCN-021 | Snapshot content remains frozen while the live original opens separately | capture immutability test; reader browser test |
| SCN-022 | Archive clears Read later; Restore returns only to All bookmarks | lifecycle test; browser acceptance test |

## Commands

- `npm run verify` — passed (16 internal, 5 browser)
- `npm audit --omit=dev` — passed (0 vulnerabilities)
- Syntax checks for server, storage, capture, and browser modules — passed

The browser suite runs Chromium against an actual HTTP server and persistent SQLite database. Each browser case begins from a controlled database state and performs the visible interactions rather than calling UI functions directly.
