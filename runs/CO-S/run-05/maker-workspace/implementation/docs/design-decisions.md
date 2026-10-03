# Design decisions

## Application shape

- Use a server-rendered static shell with a JSON API and browser-side interaction code.
- Use Node's built-in HTTP server and SQLite support. The application has no runtime package dependencies, which keeps installation and startup deterministic.
- Store production data in `implementation/data/bookmarks.db`. Tests use isolated in-memory databases.

## Bookmark model

- A bookmark stores a normalized web address, a stable captured title and description, an originating site, a page-details status, Read later state, Archive state, and timestamps.
- Labels use a separate case-insensitive table with a many-to-many association. This prevents capitalization-only duplicates while preserving the first-entered spelling.
- Web addresses are unique. The approved active-collection duplicate rule is therefore also safely enforced for archived items, avoiding two records that could collide after restore.
- Archiving always clears Read later. Restoring returns an item to the active collection without recreating its earlier Read later state.

## Page-detail collection

- Page details are collected only during initial save or an explicit retry after collection failure. They never refresh during ordinary reads, preserving the approved stable snapshot.
- Prefer Open Graph/Twitter titles, then the HTML title. Prefer standard/Open Graph/Twitter descriptions.
- If collection fails, save a recognizable title derived from the address and mark the bookmark `needs_details`.
- Metadata requests accept only HTTP(S), reject local/private destinations, validate redirect destinations, time out, and read at most 1 MB of HTML.

## Interface behavior

- All bookmarks, Read later, and Archive are persistent sidebar views.
- Search is one field over title, description, site, and labels within the current view.
- Labels are added inline from a card. Occasional actions (edit, archive, restore) live under More actions to keep cards clean.
- User-provided and remotely collected strings are escaped before insertion into HTML.
- The readiness marker is added only after the initial bookmark request succeeds and the initial valid state is rendered.

## Alternatives not selected

- Browser-only storage was rejected because it would make server-side page-detail collection and durable structured searching less dependable.
- Automatic metadata refresh was rejected because it conflicts with the approved stable-details behavior.
- Direct Archive/Edit buttons on every card were rejected in favor of the approved cleaner More actions pattern.
- A separate label-search mode was rejected in favor of the approved unified search field.
