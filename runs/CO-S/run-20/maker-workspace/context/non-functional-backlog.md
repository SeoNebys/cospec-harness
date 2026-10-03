# Non-functional & implementation-note backlog

Items noted during Phase 1 that are not functional-flow requirements but must be
considered during Phase 2 development or in later cycles. None of these interrupt
the approved functional scenarios.

## Implementation considerations (Phase 2)

- **Automatic title/description fetching (SCN-001).** In the prototype this is
  simulated. The real app must actually read the linked page's title and
  description. This needs a server-side fetch (browsers cannot read arbitrary
  cross-origin pages directly). Must degrade gracefully per SCN-006 when a page
  cannot be read.
- **Site icon (favicon).** The prototype loads icons from an external favicon
  service and falls back to a letter tile. The real app must keep the letter-tile
  fallback for when an icon is unavailable/offline.
- **Data persistence.** The collection is the client's single personal store; it
  must persist reliably between sessions. Storage mechanism to be decided in
  Phase 2 (the prototype used browser local storage only for exploration).

## Temporal perspective (edge-case exploration)

- No time-dependent behaviour is required. Saved dates are display-only; there are
  no expiries, schedules, or notifications. Recorded here as consciously N/A.

## Deferred / later-cycle requests

- (none recorded yet)
