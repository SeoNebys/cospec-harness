# Verification report — cycle 1

Verified against all 20 approved scenarios on 2026-09-24.

## Results

| Scenario | Result | Verified behavior |
|---|---|---|
| SCN-001 | Pass | Reachable pages produce recognizable cards with title, source, preview, description, reading time, and confirmation. |
| SCN-002 | Pass | Live case-insensitive search covers title, source, and description, highlights the match, and reports the count. |
| SCN-003 | Pass | Sidebar tags show counts, become visibly active, filter the collection, and remain visible on cards. |
| SCN-004 | Pass | A tag can be created and assigned from a card; card and sidebar update immediately. |
| SCN-005 | Pass | The labeled Read later toggle updates the sidebar and dedicated view without removing the main bookmark. |
| SCN-006 | Pass | Archive is a secondary card action; the card leaves All bookmarks, remains intact in Archive, and is explicitly not deleted. |
| SCN-007 | Pass | A focused editor saves and displays a personal note with confirmation. |
| SCN-008 | Pass | Note-only words are searchable and highlighted in the resulting note. |
| SCN-009 | Pass | Unreachable valid addresses produce an untitled basic card with source, full URL, and Edit title. |
| SCN-010 | Pass | Normalized exact duplicates are blocked and View existing reveals and highlights the saved card. |
| SCN-011 | Pass | Zero-result search preserves the phrase and data; Clear filters restores the collection. |
| SCN-012 | Pass | Tag matching ignores capitalization, preserves canonical spelling, and increments one existing count. |
| SCN-013 | Pass | Removing the final Read later item clears its count/view while retaining the bookmark in All bookmarks. |
| SCN-014 | Pass | Restoring the final archived item clears Archive and returns the intact card to All bookmarks. |
| SCN-015 | Pass | Edit note is prefilled and replaces, rather than duplicates, the previous reminder. |
| SCN-016 | Pass | Malformed addresses remain in the focused dialog with visible field error/example and create no bookmark. |
| SCN-017 | Pass | Content-heavy cards are clamped by default and expand/collapse in place, including hidden tags. |
| SCN-018 | Pass | Ordinary browsing uses 20-item numbered pages with active, previous, next, and direct page controls. |
| SCN-019 | Pass | Search and one tag intersect across the complete collection before pagination, with both shown in the banner. |
| SCN-020 | Pass | Details stay stable until manual refresh; success refreshes captured fields only, failure preserves them, and manual basic titles require confirmation. |

## Executed checks

- Production browser acceptance tests: two complete workflows against the real Node server and browser UI.
- Unit/integration tests: URL validation and normalization, enriched/basic records, canonical tags, search/view intersection, pagination, metadata extraction, and persistent store reload.
- Production startup smoke check: health and bookmark APIs returned successfully on port 4000.
- Visual browser check: initial loaded/empty state at 1440 × 1000, including the readiness marker.
- Final result: 9 tests passed, 0 failed.

During verification, a dense-list stacking defect was found in the tag popover. The card stacking rule was corrected and the complete suite was rerun successfully.
