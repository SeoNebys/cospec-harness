# Design decisions

## Application shape

- The application is a single-user web app served by one Node.js process.
- Bookmark data is stored in SQLite so saved state survives browser sessions and server restarts.
- The browser interface talks to a small JSON API and keeps search and active filters temporary in browser memory.
- No account or authentication layer is included because the approved goal explicitly describes one user.

## Bookmark identity

- A canonical address is stored separately from the address shown to the user.
- Fragments, common campaign/newsletter parameters, parameter ordering, hostname case, and an optional trailing slash are normalized for duplicate comparison.
- Original addresses remain available for opening and editing.
- A unique database constraint is the final protection against concurrent duplicate saves.
- Editing to a canonical address already owned by another bookmark is blocked; bookmarks are never merged implicitly.

## Page details

- On save, the server requests the page and reads common title and description metadata.
- Requests time out, follow redirects, identify the app, and limit parsed content size.
- A failed or unusable response does not prevent saving. The source site becomes the title and the description clearly identifies the fallback.

## Tags, search, and read later

- Tags are stored as a JSON list per bookmark. They retain the user's capitalization but deduplicate case-insensitively.
- Search matches title, description, and source without regard to capitalization.
- Read later is a persisted boolean on the bookmark, not a separate bookmark copy.

## Interface behavior

- The full collection, read-later view, search, and tag filtering share one screen.
- Search text and current filters are not persisted.
- Editing uses a focused dialog. Duplicate-save feedback links directly to that dialog for the existing bookmark.
- Delete requires an in-card confirmation and is permanent.
- Long titles and descriptions are limited to two visible lines; four tags remain visible and the rest are summarized.

## Alternatives not selected

- Browser-only storage was rejected because server-backed persistence gives more dependable data ownership and makes later migration possible.
- A multi-user account model was rejected as outside the approved scope.
- Automatic merging of conflicting bookmarks was rejected because it could silently discard distinct user edits.
- Refusing to save when metadata lookup fails was rejected because capturing the link is more important than enrichment.
