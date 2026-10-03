# Cycle 1 edge-case coverage

## Absence of data

- New collection empty state: covered by SCN-001.
- Search with no matches: covered by SCN-023.
- Read later after its final item is completed: covered by SCN-024.
- Archive after its final item is restored: covered by SCN-015.
- Bookmark without a personal note or tags: covered by the initial states in SCN-004, SCN-005, and SCN-010.

## Boundary conditions

- Exactly one queued item and transition to zero: covered by SCN-024.
- Several bookmarks selected together: covered by SCN-017 through SCN-020.
- Long collections remain manageable through full-field search and sorting: covered by SCN-008 and SCN-009.
- Longer personal notes use a roomy side panel: covered by SCN-010. Richer note formatting is deferred by client request.

## Error and exception states

- Valid page whose details cannot be collected: covered by SCN-021.
- Incomplete or malformed web address: covered by SCN-022.
- Exact duplicate web address: covered by SCN-003.
- Destructive single and bulk actions require deliberate confirmation: covered by SCN-016 and SCN-020.
- Same-page address normalization beyond exact matches is deferred by client request, with a conservative no-false-merge rule.

## Temporal context

- Newly saved bookmarks show immediate timing context: covered by SCN-001.
- Recently added ordering is the default and remains available after search: covered by SCN-009.
- Read later and Archive membership persist as collection state until explicitly changed: covered by SCN-011 through SCN-015.
- No feature behavior depends on calendar dates, business hours, seasons, or expiring content in the approved scope.
