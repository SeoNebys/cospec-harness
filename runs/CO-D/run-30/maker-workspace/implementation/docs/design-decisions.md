# Design decisions — cycle 1

## Application shape

- One Node.js server hosts both the browser interface and a JSON API.
- SQLite provides durable local storage without requiring a separate service. The schema separates bookmarks, labels, and their many-to-many relationship.
- The browser requests filtered result sets from the server. Search, labels, Read later, and archive conditions therefore operate on the same stored records and remain consistent for larger collections.
- The default list order is newest saved first. User-controlled sorting is deferred to the later-cycle backlog.

## Page metadata

- Page metadata is fetched by the server so the browser is not blocked by cross-origin page rules.
- Open Graph values are preferred, with standard page title and description values as fallbacks.
- Fetches have time, redirect, content-type, and size limits. Private and loopback destinations are rejected.
- When metadata cannot be collected, the hostname becomes an explicit editable title fallback. The failure never blocks saving.

## Duplicate identity

- The stored original address remains unchanged for display and opening.
- A separate normalized identity removes section fragments and a conservative list of common marketing-tracking parameters.
- Meaningful query parameters remain part of the identity. Their order is normalized, but their names and values are preserved.
- A database uniqueness constraint is the final duplicate guard, including for simultaneous save attempts.
- Active and archived bookmarks share the same identity space. Finding an archived duplicate opens it without restoring it.

## Labels and bulk work

- Label names are unique without regard to capitalization. The first stored capitalization is retained for display.
- Replacing labels during a single-item edit and adding a label during a bulk action use distinct database operations. Bulk addition never removes existing labels.
- Bulk Read later is an idempotent “turn on” operation, not a toggle.
- Selection lives in the browser and is intentionally retained after non-destructive bulk actions.

## Preservation and deletion

- User-edited title and description values are stored and never refreshed from the original page automatically.
- Archive is a reversible state on the same record, preserving all labels and Read later state.
- Permanent deletion removes the record and its label links only after explicit confirmation.
- Saving a readable copy of page content is not implemented in this cycle and is recorded for later work.

## Browser interface

- The initial data load controls the shared readiness marker.
- All user-provided content is inserted with DOM text nodes rather than interpreted as markup.
- Cards clamp long display text while editors always receive the complete stored values.
- The layout moves from three columns to two and then one for smaller browser widths.

