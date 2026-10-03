# Verification report — Cycle 1

## Result

All 15 approved scenario groups passed verification.

## Automated verification

- Command: `npm test`
- Result: 28 passed, 0 failed
- Coverage includes URL preparation and canonicalization, metadata extraction, persistence, case-insensitive tag normalization, ordinary and expressive search, no-result versus incomplete-search states, API-level creation/editing/duplicate/fallback behavior, and static application delivery.

## Browser verification

Verified in Chromium 1.61-compatible runtime against an isolated data file:

- valid and malformed initial saves;
- automatic `https://` completion;
- editing title, description, address, tags, and notes;
- side-by-side formatted note rendering and formatting controls;
- collection row rendering and three-dot edit menu;
- live note search with explanatory excerpt;
- zero-match and incomplete-expression states;
- case-insensitive duplicate-tag feedback;
- cluttered-link duplicate recognition without a second row;
- long title/description clamping and four-tag expansion;
- click-to-filter tag behavior;
- unavailable-page save-first fallback and missing-preview state.

## Layout verification

- Desktop viewport: 1440 × 1100, no horizontal overflow.
- Narrow viewport: 390 × 844, no horizontal overflow; note panes stack into one column.
- Visual inspection confirmed the clean collection hierarchy, compact tag treatment, menu placement, editor spacing, and formatted-note readability.

## Data isolation

Browser verification used a temporary bookmark data file. The production data file remains an empty collection ready for acceptance.
