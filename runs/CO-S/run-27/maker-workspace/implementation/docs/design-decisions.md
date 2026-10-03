# Design decisions

- A small dependency-free Node.js HTTP service keeps installation and review startup predictable. Bookmark data is stored in an atomically replaced JSON file because this cycle is explicitly for one person and does not require accounts or shared concurrent access.
- Server endpoints own address validation, duplicate checks, tag normalization, metadata retrieval, search, read-later changes, edits, and deletion. The browser owns presentation and retains in-progress form state when a request fails.
- Exact duplicate detection uses the browser-standard normalized form of an HTTP(S) address. Query strings and section markers remain meaningful. Broader removal of tracking information is deferred as approved.
- Tags are stored in normalized lowercase form, with surrounding whitespace removed and internal whitespace collapsed. This gives stable exact filtering and prevents case/space duplicates.
- Metadata retrieval follows redirects, accepts HTML only, has an eight-second timeout, and falls back to the site name. The bookmark can still be saved after failure.
- Saved addresses open in a new tab. Destructive deletion always requires a dialog confirmation.

Alternatives not chosen: browser-only storage would make server-side metadata retrieval unreliable and harder to preserve; a database and account system would exceed the approved single-person scope.
