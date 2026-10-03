# Design decisions

## Runtime and persistence

- The production app is a single Node.js process serving a browser client and JSON API.
- SQLite is used through Node's built-in `node:sqlite` module. It gives the single-user app durable, transactional storage without requiring an external service.
- The database lives under `implementation/data/` by default and can be overridden with `KEEPWELL_DB` for tests.

## Page capture

- Page details and readable content are fetched by the server at save time.
- The capture is immutable: later visits to the live page do not replace stored content.
- Metadata is extracted from standard page tags; readable content comes from `article`, `main`, or the cleaned page body in that order.
- Stored HTML is sanitized. Links are made absolute. A bounded number of page images are embedded as data URLs so captured pages remain useful when the original disappears.
- Requests to loopback, link-local, and private-network destinations are rejected to prevent the bookmark fetcher from becoming a private-network probe.
- If capture fails, the API returns a distinct response and saves nothing. The client may then submit explicitly approved manual details with a `no-copy` status.

## Duplicate identity

- Bookmark identity is based on a canonical URL: host and protocol are normalized, fragments and common tracking parameters are removed, query parameters are sorted, and non-root trailing slashes are removed.
- Duplicate saves never update the existing record or its saved date.

## State model

- Read later and Archive are flags on one bookmark, not copies.
- Archiving clears Read later. Restoring does not reinstate it.
- Permanent deletion cascades through tag links and removes the saved copy.
- Tags are normalized to lowercase and cease to exist when no bookmark uses them.
- Saved views persist search text, one tag filter, and sort order.

## Browser experience

- The client is a small dependency-free application served as static files.
- Search, filters, sorting, section navigation, and paging update without full-page navigation.
- Eight bookmarks appear per page.
- Dedicated dialogs protect destructive deletion and saved-view naming. Detail and tag editing use side panels. Saved copies use a focused reading view.
