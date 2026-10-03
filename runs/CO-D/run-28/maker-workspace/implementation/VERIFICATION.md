# Verification record (Phase 3, Cycle 1)

Command: `npm test` (from implementation/, with PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers).

## Results
- Unit/integration (node:test): 30 passed, 0 failed.
  - normalize.test.js — SCN-001, SCN-011, SCN-012 (scheme add, invalid reject,
    trailing-slash/scheme/www normalisation, query significance, prefer-https).
  - search.test.js — SCN-003, SCN-005 (case-insensitive, notes searched, #tag,
    phrase, AND/OR/NOT, grouping, quoted operators literal, incomplete flagged,
    highlight terms).
  - bookmarks-html.test.js — SCN-019 (export format w/ title/tags/dates, round-trip,
    empty/non-bookmark import yields nothing, real-export snippet).
  - store.test.js — SCN-001/011 (create/validation), SCN-008/012 (dedupe + https),
    SCN-015 (address edit conflict/validation), SCN-013 (updatedAt on detail edit
    only), SCN-017 (collections).
- Acceptance (Playwright, UI end-to-end): 6 passed, 0 failed.
  - save & appears (SCN-001/009), no-duplicate re-save (SCN-008/012), search across
    fields + #tag + incomplete-query flag (SCN-003/005), read-later + archive views
    (SCN-006/007), permanent delete with confirm (SCN-014), save/apply collection
    (SCN-017).

## Honest coverage notes (external services)
- SCN-018 (local snapshot, Internet Archive) and SCN-021 (favicon/preview fetch)
  perform real outbound network I/O server-side. Their happy paths need internet
  and were NOT executed in the offline sandbox. Verified here instead:
  - The graceful-degradation paths are exercised in the app (add-flow when metadata
    fetch fails → SCN-009 acceptance test passes), and endpoints return honest
    error/reason payloads (code reviewed in lib/metadata.js).
  - Full online validation of real capture/archive/favicon/preview is to be
    confirmed during acceptance in an environment with outbound network.
- These are reported as not-yet-validated-online rather than claimed as proven.

## UI coverage not automated (verified by build + manual review, to confirm in Phase 4)
- SCN-002 item display/edit, SCN-004 tag suggestions, SCN-010 empty states,
  SCN-013 default-vs-temporary sort UI, SCN-016 bulk bar interactions,
  SCN-019 import/export via Settings, SCN-020 text size & paging.
