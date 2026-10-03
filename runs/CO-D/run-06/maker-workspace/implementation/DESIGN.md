# Tuck implementation design

## Decisions

- The application is a small Node.js service with a browser client. This keeps page-detail retrieval on the server, where cross-site page requests are possible, while search and tag filtering remain immediate in the browser.
- Bookmarks are persisted in `implementation/data/bookmarks.json` through an atomic temporary-file rename. The storage class is isolated so a database can replace it later without changing the HTTP or browser behavior.
- Duplicate identity uses a canonical address that ignores hostname capitalization, default ports, trailing slashes, and jump-to-section fragments. Query strings remain significant because they may select different content.
- Removal is soft for eight seconds. A removed record remains recoverable through a restore endpoint, then is purged. This supports exact-position client restoration without a confirmation dialog.
- Page-detail retrieval follows a bounded number of redirects, allows only HTTP(S), rejects local/private destinations, limits time and parsed document size, and falls back cleanly when unavailable.
- All user-provided content is rendered through DOM text nodes. No bookmark content is injected as HTML.
- Search checks title, description, and address case-insensitively on every input event. Tag filtering uses normalized lowercase tags and can be activated from the filter row or directly from a bookmark chip.

## Alternatives not selected

- Exclusive folders were rejected in favor of overlapping tags per SCN-008.
- Permanently visible remove buttons and confirm-before-remove dialogs were rejected per SCN-005 and SCN-010.
- Blocking save when page details fail was rejected per SCN-012.
- A client-only application was rejected because reliable metadata retrieval is restricted by other sites' browser policies and would not provide dependable persistence.

## Operational notes

- `TUCK_DATA_FILE` overrides the data path for tests or deployment.
- `PORT` defaults to `4000`; `HOST` defaults to `0.0.0.0`.
- No third-party runtime packages are required.
