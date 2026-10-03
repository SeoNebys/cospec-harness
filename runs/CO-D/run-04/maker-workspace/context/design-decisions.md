# Cycle 1 design decisions

## Application shape

- A single Node.js process serves both the browser application and JSON API.
- SQLite is the persistent store. The default database is
  `implementation/data/trove.db`; it is created automatically.
- The app is personal and local-first. There is no account or login layer,
  matching the approved scope.
- Production code lives exclusively in `implementation/`. The exploration
  prototype was not imported, referenced, or reused.

Alternatives not selected:

- Browser-only storage was rejected because server-side metadata retrieval and
  durable relational label data are required.
- An external database or hosted account service was rejected as unnecessary
  for a one-person application.
- A framework-heavy client was rejected because the approved interaction model
  can be implemented accessibly with a small, dependency-light browser app.

## Bookmark and label data

- Bookmarks store the original clean display address and a separate canonical
  address for duplicate detection.
- Canonicalization removes fragments, a leading `www`, trailing slashes, and
  recognized campaign parameters. Meaningful query parameters remain.
- Labels are stored once using a case-insensitive canonical name and joined to
  any number of bookmarks.
- Archive and Read later are independent persisted states. Archived bookmarks
  are excluded from All bookmarks, Read later, label counts, and normal search.
- Permanent deletion cascades through label joins and has no undo record.

## Metadata retrieval

- The server retrieves page HTML with an eight-second timeout and reads common
  Open Graph, Twitter, standard description, title, and icon fields.
- Metadata failure returns a usable manual-entry fallback instead of blocking a
  valid address.
- The app never revisits saved pages automatically, so an external outage
  cannot remove or rewrite stored bookmark data.

## Search

- Search is evaluated on the server against the currently selected view.
- It is case-insensitive and covers title, description, website name, address,
  and labels.
- One parser supports plain terms, `label:`, quoted phrases, `-` exclusions,
  `OR`, and adjacent implicit-AND criteria.
- An unfinished quoted phrase is a syntax response, leaving the browser's
  current results intact until corrected.

## Browser behavior

- The bookmark content is a direct external link; Edit, Read later, and Archive
  are separate controls.
- Save always pauses after retrieval for review. Duplicate detection occurs
  before retrieval and focuses the existing stored item.
- Lists start at twenty rows and append twenty more without removing earlier
  rows.
- Collection rows visually limit title and description length, but edit fields
  always contain the complete stored values.

## Testing

- Unit tests cover URL normalization, search parsing, storage constraints,
  labels, state transitions, and large-list slicing.
- Chromium acceptance tests run the real server, SQLite database, API, and
  production interface against every approved scenario.
- Test-only page fixtures and database reset endpoints are disabled unless
  `TROVE_ENABLE_TEST_FIXTURES=1` is explicitly set.
