# Keep implementation design

## Shape

Keep is a self-contained personal web application:

- `server.js` serves the browser app and a JSON API.
- `lib/bookmarks.js` owns bookmark identity, validation, status transitions, labels, and deletion.
- `lib/metadata.js` fetches and extracts readable page details with a five-second limit and a safe fallback.
- `lib/store.js` persists the collection to a JSON file using atomic replacement.
- `public/` contains a dependency-free browser interface and the shared search evaluator.

There are no user accounts in cycle 1. The one stored collection is the personal library.

## Data model

Each bookmark stores its original address, a canonical address used only for duplicate identity, fetched or edited display details, labels, Read Later and Archive status, metadata-fetch status, and timestamps. Archive and Read Later are statuses on one bookmark rather than copies.

## Important decisions

- Metadata failure preserves a valid link and records `metadataStatus: failed`; retry and manual editing remain available.
- Duplicate identity removes URL fragments and a conservative allowlist of tracking parameters. Other query values remain significant.
- Label uniqueness ignores surrounding whitespace and capitalization while retaining the first displayed spelling.
- Archiving clears Read Later, because archived items must not remain in the everyday queue.
- Permanent deletion is a direct storage removal, but the browser requires a named confirmation first.
- Search runs in the browser over the selected destination. It supports case-insensitive plain terms, quoted phrases, `OR`, exclusions, typed label conditions, visible all/exact/any controls, and visible label inclusion/exclusion.
- Archived items never enter All Bookmarks or Read Later results; searching Archive is deliberate and separately scoped.
- Statuses have no automatic expiry or cleanup.
- Long display text is clamped only in the card view; stored values and search remain complete.

## Alternatives not selected

- Accounts and shared libraries were excluded from the approved personal-app scope.
- Database infrastructure was avoided for the first personal deployment; the storage boundary is isolated so it can be replaced later.
- Archive-first deletion was rejected in favor of deletion from any card plus explicit confirmation.
- Icon-only Read Later and always-visible Archive actions were rejected in favor of a labeled Read Later button and an extra-actions menu.
- Prototype source was not reused; production code was created independently from the approved scenarios.

## Later-cycle impact points

- Bookmark fields and search indexing are centralized, so adding private notes will affect the bookmark schema, edit UI, search evaluator, persistence migration, and corresponding tests.
- Replacing JSON storage primarily affects `JsonStore` and server construction.
- Adding destinations affects the status predicates in the service and browser view filtering.
